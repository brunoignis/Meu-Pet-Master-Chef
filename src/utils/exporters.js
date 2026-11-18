import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  ImageRun,
  AlignmentType
} from 'docx';
import * as XLSX from 'xlsx';
import { CATEGORIAS_INGREDIENTES } from '../db/database';
import { DIAS_SEMANA } from './calculations';

/* =========================================================
   AUXILIARES DE ARQUIVO & COMPARTILHAMENTO ANDROID
========================================================= */
function limparNomeArquivo(texto) {
  return (texto || 'cardapio-pet')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .toLowerCase();
}

function formatarDataBR(iso) {
  if (!iso) return '-';
  const partes = iso.split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : iso;
}

function labelCategoria(catId) {
  return CATEGORIAS_INGREDIENTES.find((c) => c.id === catId)?.label || catId;
}

function textoSaldo(g) {
  if (g.status === 'ok') return 'Exato';
  if (g.status === 'falta') return `Faltam ${g.absDiferencaG.toFixed(1)} g`;
  return `Sobram ${g.absDiferencaG.toFixed(1)} g`;
}

function formatarDiasSemana(dias = []) {
  if (!dias.length) return 'Nenhum dia';
  return dias
    .map((id) => DIAS_SEMANA.find((d) => d.id === id)?.label || id)
    .join(', ');
}

function base64DataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function salvarECompartilhar({ nomeArquivo, base64SemPrefixo, blobWeb }) {
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: nomeArquivo,
      data: base64SemPrefixo,
      directory: Directory.Cache
    });
    const uriResult = await Filesystem.getUri({
      directory: Directory.Cache,
      path: nomeArquivo
    });
    await Share.share({
      title: nomeArquivo,
      text: 'Cardápio Meu Pet Chef',
      url: uriResult.uri,
      dialogTitle: 'Compartilhar ou Salvar Cardápio'
    });
  } else {
    const url = URL.createObjectURL(blobWeb);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/* =========================================================
   1. EXPORTAR PDF (jsPDF + autoTable v5)
========================================================= */
export async function exportarPDF({ evento, resumoAnimais, comparativo, analiseSups, tabelaNutricional }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margem = 14;
  let y = 16;

  // Cabeçalho estilizado Meu Pet Chef
  doc.setFillColor(47, 125, 143);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('Meu Pet Chef - Cardápio & Preparo Saudável', margem, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(evento.titulo || 'Prescrição Nutricional', margem, 21);

  y = 36;
  doc.setTextColor(26, 70, 82);
  doc.setFontSize(10);

  const infoGeral = [
    ['Data do Preparo', formatarDataBR(evento.dataPreparo), 'Duração', `${resumoAnimais.diasDuracao} dias`],
    ['Tutor(es)', evento.tutorNome || '-', 'Nº de Animais', String(resumoAnimais.numeroAnimais)],
    [
      'Responsável Técnico',
      `${evento.responsavelTecnico || '-'} ${evento.crmv ? `(${evento.crmv})` : ''}`,
      'Total do Lote',
      `${resumoAnimais.totalPeriodoGeralG.toFixed(0)} g`
    ]
  ];

  autoTable(doc, {
    startY: y,
    body: infoGeral,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [239, 248, 250] },
      2: { fontStyle: 'bold', fillColor: [239, 248, 250] }
    }
  });
  y = doc.lastAutoTable.finalY + 6;

  // Tabela de Animais
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Animais & Porcionamento', margem, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Animal', 'Idade', 'Sexo', 'Refeições/dia', 'Peso/Refeição', 'Total Diário', 'Total Período']],
    body: resumoAnimais.detalhes.map((a) => [
      a.nome || '-',
      a.idade || '-',
      a.sexo || '-',
      String(a.refeicoesDia),
      `${a.pesoRefeicaoG} g`,
      `${a.totalDiarioG.toFixed(0)} g`,
      `${a.totalPeriodoG.toFixed(0)} g`
    ]),
    headStyles: { fillColor: [47, 125, 143] },
    styles: { fontSize: 8.5 }
  });
  y = doc.lastAutoTable.finalY + 6;

  // Fotos dos Pets (se existirem)
  const petsComFoto = (evento.animais || []).filter((a) => a.foto);
  if (petsComFoto.length > 0) {
    if (y > 245) {
      doc.addPage();
      y = 16;
    }
    let xFoto = margem;
    petsComFoto.forEach((p) => {
      try {
        const formato = p.foto.includes('image/png') ? 'PNG' : 'JPEG';
        doc.addImage(p.foto, formato, xFoto, y, 22, 22);
        doc.setFontSize(7.5);
        doc.text((p.nome || '').slice(0, 14), xFoto, y + 26);
        xFoto += 26;
        if (xFoto > 175) {
          xFoto = margem;
          y += 30;
        }
      } catch {
        // Ignora foto corrompida
      }
    });
    y += 31;
  }

  // Comparativo dos Grupos
  if (y > 235) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Grupos de Alimentos (% Meta vs. Inserido)', margem, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Grupo', '%', 'Meta (g)', 'Inserido (g)', 'Situação']],
    body: comparativo.grupos.map((g) => [
      g.label,
      `${g.percentual}%`,
      `${g.metaG.toFixed(1)} g`,
      `${g.inseridoG.toFixed(1)} g`,
      textoSaldo(g)
    ]),
    headStyles: { fillColor: [47, 125, 143] },
    styles: { fontSize: 8.5 }
  });
  y = doc.lastAutoTable.finalY + 6;

  // Ingredientes + Água
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ingredientes do Preparo (Água: ${evento.aguaMl || 0} ml)`, margem, y);
  y += 2;

  const linhasIng = (evento.ingredientes || []).map((i) => [
    labelCategoria(i.categoria),
    i.nome,
    `${Number(i.quantidadeG || 0).toFixed(1)} g`
  ]);
  if (Number(evento.aguaMl) > 0) {
    linhasIng.push(['Água', 'Água filtrada/preparo', `${evento.aguaMl} ml`]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Categoria', 'Ingrediente', 'Quantidade']],
    body: linhasIng.length ? linhasIng : [['-', 'Nenhum ingrediente inserido', '-']],
    headStyles: { fillColor: [47, 125, 143] },
    styles: { fontSize: 8.5 }
  });
  y = doc.lastAutoTable.finalY + 6;

  // Suplementos
  if (analiseSups.length > 0) {
    if (y > 235) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Suplementação', margem, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Suplemento / Marca', 'Lote / Validade', 'Dose/Refeição', 'Substâncias (Rótulo)']],
      body: analiseSups.map((s) => [
        `${s.nome}\n${s.marca || ''}`,
        `Lote: ${s.lote || '-'}\nVal: ${formatarDataBR(s.validade)}`,
        `${s.qtdPorRefeicao} ${s.unidade}`,
        (s.substancias || []).map((sub) => `${sub.nome}: ${sub.quantidade}${sub.unidade}`).join(', ') || '-'
      ]),
      headStyles: { fillColor: [47, 125, 143] },
      styles: { fontSize: 8 }
    });
    y = doc.lastAutoTable.finalY + 6;

    // Fotos dos Suplementos
    const fotosSup = analiseSups.flatMap((s) => (s.fotos || []).map((f) => ({ nome: s.nome, foto: f })));
    if (fotosSup.length > 0) {
      if (y > 245) {
        doc.addPage();
        y = 16;
      }
      let xSup = margem;
      fotosSup.forEach((item) => {
        try {
          const formato = item.foto.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(item.foto, formato, xSup, y, 22, 22);
          doc.setFontSize(7);
          doc.text((item.nome || '').slice(0, 14), xSup, y + 26);
          xSup += 26;
          if (xSup > 175) {
            xSup = margem;
            y += 30;
          }
        } catch {
          // Ignora
        }
      });
      y += 31;
    }
  }

  // Alimentos Avulsos
  if ((evento.avulsos || []).length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Alimentos Ofertados Avulso', margem, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [['Alimento', 'Quantidade', 'Frequência (Dias da Semana)']],
      body: evento.avulsos.map((a) => [
        a.nome || '-',
        `${a.quantidadeG} g`,
        `${(a.diasSemana || []).length}x/sem (${formatarDiasSemana(a.diasSemana)})`
      ]),
      headStyles: { fillColor: [47, 125, 143] },
      styles: { fontSize: 8.5 }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Tabela Nutricional
  if (y > 225) {
    doc.addPage();
    y = 16;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Tabela Nutricional', margem, y);
  y += 4;

  if (!tabelaNutricional.completa) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 70, 40);
    const faltantes = tabelaNutricional.itensSemDados.map((i) => i.nome).join(', ');
    doc.text(`Faltam dados nutricionais no banco para: ${faltantes}`, margem, y, { maxWidth: 180 });
    y += 10;
    doc.setTextColor(26, 70, 82);
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Nutriente', 'Por Refeição', 'Diária', 'Semanal']],
      body: tabelaNutricional.linhas.map((l) => [
        `${l.label} (${l.unidade})`,
        l.porRefeicao.toFixed(1),
        l.diaria.toFixed(1),
        l.semanal.toFixed(1)
      ]),
      headStyles: { fillColor: [82, 164, 90] },
      styles: { fontSize: 8.5 }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // Observações
  if (evento.observacoes?.trim()) {
    if (y > 245) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações', margem, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(evento.observacoes, margem, y, { maxWidth: 180 });
  }

  const nomeArquivo = `${limparNomeArquivo(evento.titulo)}.pdf`;
  const dataUri = doc.output('datauristring');
  const base64SemPrefixo = dataUri.split(',')[1];
  const blobWeb = doc.output('blob');

  await salvarECompartilhar({ nomeArquivo, base64SemPrefixo, blobWeb });
}

/* =========================================================
   2. EXPORTAR DOCX (Word .docx nativo via docx v9)
========================================================= */
export async function exportarDOCX({ evento, resumoAnimais, comparativo, analiseSups, tabelaNutricional }) {
  const criarCelula = (texto, bold = false) =>
    new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: String(texto ?? '-'), bold, size: 20 })]
        })
      ]
    });

  const criarTabela = (cabecalho, linhas) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: cabecalho.map((h) => criarCelula(h, true))
        }),
        ...linhas.map(
          (linha) =>
            new TableRow({
              children: linha.map((col) => criarCelula(col, false))
            })
        )
      ]
    });

  const children = [
    new Paragraph({
      text: 'Meu Pet Chef - Cardápio & Preparo Saudável',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({
      children: [new TextRun({ text: evento.titulo || 'Cardápio Pet', bold: true, size: 26 })],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [
        new TextRun({ text: `Data do Preparo: `, bold: true }),
        new TextRun(`${formatarDataBR(evento.dataPreparo)}   |   `),
        new TextRun({ text: `Duração: `, bold: true }),
        new TextRun(`${resumoAnimais.diasDuracao} dias   |   `),
        new TextRun({ text: `Nº Animais: `, bold: true }),
        new TextRun(`${resumoAnimais.numeroAnimais}`)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Tutor(es): `, bold: true }),
        new TextRun(`${evento.tutorNome || '-'}   |   `),
        new TextRun({ text: `Responsável Técnico: `, bold: true }),
        new TextRun(`${evento.responsavelTecnico || '-'} ${evento.crmv ? `(${evento.crmv})` : ''}`)
      ]
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Animais e Porcionamento', heading: HeadingLevel.HEADING_2 }),
    criarTabela(
      ['Nome', 'Idade', 'Sexo', 'Refeições/dia', 'Peso/Refeição', 'Total Período'],
      resumoAnimais.detalhes.map((a) => [
        a.nome || '-',
        a.idade || '-',
        a.sexo || '-',
        a.refeicoesDia,
        `${a.pesoRefeicaoG} g`,
        `${a.totalPeriodoG.toFixed(0)} g`
      ])
    )
  ];

  // Imagens dos pets
  const fotosPetsRuns = [];
  (evento.animais || []).forEach((a) => {
    if (!a.foto) return;
    try {
      fotosPetsRuns.push(
        new ImageRun({
          type: a.foto.includes('image/png') ? 'png' : 'jpg',
          data: base64DataUrlToUint8Array(a.foto),
          transformation: { width: 90, height: 90 }
        }),
        new TextRun(`  ${a.nome}   `)
      );
    } catch {
      // Ignora erro de imagem
    }
  });
  if (fotosPetsRuns.length > 0) {
    children.push(new Paragraph({ text: '' }), new Paragraph({ children: fotosPetsRuns }));
  }

  // Comparativo dos Grupos
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Grupos de Alimentos (% Meta vs. Inserido)', heading: HeadingLevel.HEADING_2 }),
    criarTabela(
      ['Grupo', '%', 'Meta (g)', 'Inserido (g)', 'Status'],
      comparativo.grupos.map((g) => [
        g.label,
        `${g.percentual}%`,
        `${g.metaG.toFixed(1)} g`,
        `${g.inseridoG.toFixed(1)} g`,
        textoSaldo(g)
      ])
    )
  );

  // Ingredientes + Água
  const linhasIng = (evento.ingredientes || []).map((i) => [
    labelCategoria(i.categoria),
    i.nome,
    `${Number(i.quantidadeG || 0).toFixed(1)} g`
  ]);
  linhasIng.push(['Água', 'Água no preparo', `${evento.aguaMl || 0} ml`]);

  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Ingredientes e Água', heading: HeadingLevel.HEADING_2 }),
    criarTabela(['Grupo', 'Ingrediente', 'Quantidade'], linhasIng)
  );

  // Suplementos
  if (analiseSups.length > 0) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Suplementos', heading: HeadingLevel.HEADING_2 }),
      criarTabela(
        ['Nome / Marca', 'Lote', 'Validade', 'Dose/Refeição', 'Substâncias (Rótulo)'],
        analiseSups.map((s) => [
          `${s.nome} (${s.marca || '-'})`,
          s.lote || '-',
          formatarDataBR(s.validade),
          `${s.qtdPorRefeicao} ${s.unidade}`,
          (s.substancias || []).map((sub) => `${sub.nome}: ${sub.quantidade}${sub.unidade}`).join(', ') || '-'
        ])
      )
    );

    const fotosSupRuns = [];
    analiseSups.forEach((s) => {
      (s.fotos || []).forEach((f) => {
        try {
          fotosSupRuns.push(
            new ImageRun({
              type: f.includes('image/png') ? 'png' : 'jpg',
              data: base64DataUrlToUint8Array(f),
              transformation: { width: 95, height: 95 }
            }),
            new TextRun('  ')
          );
        } catch {
          // Ignora
        }
      });
    });
    if (fotosSupRuns.length > 0) {
      children.push(new Paragraph({ text: '' }), new Paragraph({ children: fotosSupRuns }));
    }
  }

  // Avulsos
  if ((evento.avulsos || []).length > 0) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Alimentos Ofertados Avulso', heading: HeadingLevel.HEADING_2 }),
      criarTabela(
        ['Alimento', 'Quantidade', 'Frequência'],
        evento.avulsos.map((a) => [
          a.nome || '-',
          `${a.quantidadeG} g`,
          `${(a.diasSemana || []).length}x/sem (${formatarDiasSemana(a.diasSemana)})`
        ])
      )
    );
  }

  // Tabela Nutricional
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({ text: 'Tabela Nutricional', heading: HeadingLevel.HEADING_2 })
  );
  if (!tabelaNutricional.completa) {
    children.push(
      new Paragraph({
        text: `Faltam dados nutricionais no banco interno para: ${tabelaNutricional.itensSemDados
          .map((i) => i.nome)
          .join(', ')}`
      })
    );
  } else {
    children.push(
      criarTabela(
        ['Nutriente', 'Por Refeição', 'Diária', 'Semanal'],
        tabelaNutricional.linhas.map((l) => [
          `${l.label} (${l.unidade})`,
          l.porRefeicao.toFixed(1),
          l.diaria.toFixed(1),
          l.semanal.toFixed(1)
        ])
      )
    );
  }

  if (evento.observacoes?.trim()) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({ text: 'Observações', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: evento.observacoes })
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const nomeArquivo = `${limparNomeArquivo(evento.titulo)}.docx`;
  const base64SemPrefixo = await Packer.toBase64String(doc);
  const blobWeb = await Packer.toBlob(doc);

  await salvarECompartilhar({ nomeArquivo, base64SemPrefixo, blobWeb });
}

/* =========================================================
   3. EXPORTAR XLSX (Planilha Excel multi-abas)
========================================================= */
export async function exportarXLSX({ evento, resumoAnimais, comparativo, analiseSups, tabelaNutricional }) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Resumo & Animais
  const abaResumo = [
    ['MEU PET CHEF - CARDÁPIO & PREPARO SAUDÁVEL'],
    ['Título', evento.titulo || '-'],
    ['Data do Preparo', formatarDataBR(evento.dataPreparo)],
    ['Duração (dias)', resumoAnimais.diasDuracao],
    ['Tutor(es)', evento.tutorNome || '-'],
    ['Responsável Técnico', `${evento.responsavelTecnico || '-'} ${evento.crmv ? `(${evento.crmv})` : ''}`],
    ['Número de Animais', resumoAnimais.numeroAnimais],
    ['Volume Total do Preparo (g)', Number(resumoAnimais.totalPeriodoGeralG.toFixed(1))],
    ['Água no Preparo (ml)', Number(evento.aguaMl || 0)],
    ['Observações', evento.observacoes || '-'],
    [],
    ['ANIMAIS'],
    ['Nome', 'Idade', 'Sexo', 'Refeições/Dia', 'Peso/Refeição (g)', 'Total Diário (g)', 'Total Período (g)'],
    ...resumoAnimais.detalhes.map((a) => [
      a.nome,
      a.idade,
      a.sexo,
      a.refeicoesDia,
      a.pesoRefeicaoG,
      a.totalDiarioG,
      a.totalPeriodoG
    ])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaResumo), 'Resumo e Pets');

  // Aba 2: Grupos (% vs g) e Ingredientes
  const abaIngredientes = [
    ['COMPARATIVO DOS GRUPOS'],
    ['Grupo', 'Percentual (%)', 'Meta (g)', 'Inserido (g)', 'Diferença (g)', 'Situação'],
    ...comparativo.grupos.map((g) => [
      g.label,
      g.percentual,
      Number(g.metaG.toFixed(1)),
      Number(g.inseridoG.toFixed(1)),
      Number(g.diferencaG.toFixed(1)),
      textoSaldo(g)
    ]),
    [],
    ['INGREDIENTES INSERIDOS'],
    ['Categoria', 'Ingrediente', 'Quantidade (g)'],
    ...(evento.ingredientes || []).map((i) => [
      labelCategoria(i.categoria),
      i.nome,
      Number(i.quantidadeG || 0)
    ]),
    ['Água', 'Água no preparo (ml)', Number(evento.aguaMl || 0)]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaIngredientes), 'Ingredientes');

  // Aba 3: Suplementos & Avulsos
  const abaSupAv = [
    ['SUPLEMENTOS'],
    ['Nome', 'Marca', 'Lote', 'Validade', 'Qtd/Refeição', 'Unidade', 'Total Período', 'Substâncias (Rótulo)'],
    ...analiseSups.map((s) => [
      s.nome,
      s.marca,
      s.lote,
      formatarDataBR(s.validade),
      s.qtdPorRefeicao,
      s.unidade,
      s.qtdTotalPeriodo,
      (s.substancias || []).map((sub) => `${sub.nome}: ${sub.quantidade}${sub.unidade}`).join(' | ')
    ]),
    [],
    ['ALIMENTOS OFERTADOS AVULSO'],
    ['Alimento', 'Quantidade (g)', 'Vezes na Semana', 'Dias'],
    ...(evento.avulsos || []).map((a) => [
      a.nome,
      Number(a.quantidadeG || 0),
      (a.diasSemana || []).length,
      formatarDiasSemana(a.diasSemana)
    ])
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaSupAv), 'Supl e Avulsos');

  // Aba 4: Tabela Nutricional
  const abaNutri = [['TABELA NUTRICIONAL']];
  if (!tabelaNutricional.completa) {
    abaNutri.push([
      'Status',
      `Faltam dados nutricionais para: ${tabelaNutricional.itensSemDados.map((i) => i.nome).join(', ')}`
    ]);
  } else {
    abaNutri.push(['Nutriente', 'Unidade', 'Por Refeição', 'Diária', 'Semanal']);
    tabelaNutricional.linhas.forEach((l) => {
      abaNutri.push([
        l.label,
        l.unidade,
        Number(l.porRefeicao.toFixed(2)),
        Number(l.diaria.toFixed(2)),
        Number(l.semanal.toFixed(2))
      ]);
    });
  }
  if (tabelaNutricional.substanciasSuplementos.length > 0) {
    abaNutri.push([], ['SUBSTÂNCIAS DOS SUPLEMENTOS'], ['Substância', 'Unidade', 'Refeição', 'Diária', 'Semanal']);
    tabelaNutricional.substanciasSuplementos.forEach((s) => {
      abaNutri.push([
        s.nome,
        s.unidade,
        Number(s.porRefeicao.toFixed(2)),
        Number(s.diaria.toFixed(2)),
        Number(s.semanal.toFixed(2))
      ]);
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaNutri), 'Tabela Nutricional');

  const nomeArquivo = `${limparNomeArquivo(evento.titulo)}.xlsx`;
  const base64SemPrefixo = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blobWeb = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  await salvarECompartilhar({ nomeArquivo, base64SemPrefixo, blobWeb });
}