import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';
import { db, CATEGORIAS_INGREDIENTES, NUTRIENTES_PADRAO } from '../db/database';

function normalizarTexto(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseNumeroOpcional(val) {
  if (val === null || val === undefined) return null;
  const txt = String(val).trim();
  if (txt === '') return null;
  const limpo = txt.replace(',', '.').replace(/[^0-9.-]/g, '');
  if (limpo === '' || limpo === '-' || limpo === '.') return null;
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

function resolverCategoria(valor) {
  const norm = normalizarTexto(valor);
  if (norm.includes('desossada') || norm === 'carne') return 'carne_desossada';
  if (norm.includes('muscular')) return 'viscera_muscular';
  if (norm.includes('secretora')) return 'viscera_secretora';
  if (norm.includes('vegeta')) return 'vegetal';
  if (norm.includes('avulso')) return 'avulso';
  const direta = CATEGORIAS_INGREDIENTES.find((c) => c.id === norm);
  return direta ? direta.id : 'vegetal';
}

function labelCategoria(catId) {
  return CATEGORIAS_INGREDIENTES.find((c) => c.id === catId)?.label || catId;
}

function parseDataExcel(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
  }
  const txt = String(val).trim();
  const brMatch = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const isoMatch = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return txt;
  return '';
}

function formatarDataBR(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

async function enviarArquivoExcel(wb, nomeArquivo) {
  const base64SemPrefixo = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blobWeb = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

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
      url: uriResult.uri,
      dialogTitle: 'Salvar ou Compartilhar Planilha Excel'
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

function montarCabecalhoIngredientes() {
  return [
    'nome',
    'categoria',
    'dados_completos',
    ...NUTRIENTES_PADRAO.map((n) => n.excelCol)
  ];
}

function montarWorkbook({ ingredientes = [], suplementos = [] }) {
  const wb = XLSX.utils.book_new();

  const cabIng = montarCabecalhoIngredientes();
  const linhasIng = ingredientes.map((ing) => [
    ing.nome || '',
    labelCategoria(ing.categoria),
    ing.dadosCompletos ? 'SIM' : 'NAO',
    ...NUTRIENTES_PADRAO.map((n) => {
      const val = ing.nutrientes100g?.[n.key];
      return val === null || val === undefined || val === '' ? '' : Number(val);
    })
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabIng, ...linhasIng]), 'Ingredientes');

  const cabSup = ['nome', 'marca', 'lote', 'validade', 'unidade'];
  const linhasSup = suplementos.map((s) => [
    s.nome || '',
    s.marca || '',
    s.lote || '',
    formatarDataBR(s.validade),
    s.unidade || 'g'
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabSup, ...linhasSup]), 'Suplementos');

  const cabSub = ['suplemento_nome', 'substancia', 'quantidade', 'unidade'];
  const linhasSub = [];
  suplementos.forEach((s) => {
    (s.substancias || []).forEach((sub) => {
      linhasSub.push([
        s.nome || '',
        sub.nome || '',
        sub.quantidade === null || sub.quantidade === undefined ? '' : Number(sub.quantidade),
        sub.unidade || ''
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cabSub, ...linhasSub]), 'Suplementos_Substancias');

  const instrucoes = [
    ['INSTRUÇÕES DE PREENCHIMENTO - MEU PET CHEF'],
    [''],
    ['1. ABA INGREDIENTES (valores por 100g do alimento):'],
    ['- Coluna nome: obrigatória.'],
    ['- Coluna categoria: use Carne Desossada, Víscera Muscular, Víscera Secretora, Vegetais ou Alimento Avulso.'],
    ['- Coluna dados_completos: coloque SIM ou NAO (se deixar em branco, o app considera SIM se houver ao menos 1 nutriente preenchido).'],
    ['- Vitaminas e minerais: PODE DEIXAR EM BRANCO as colunas que o alimento não possuir ou que não tiver informação.'],
    ['- Não altere os nomes das colunas da primeira linha.'],
    [''],
    ['2. ABA SUPLEMENTOS:'],
    ['- Coluna nome: obrigatória.'],
    ['- Coluna validade: use DD/MM/AAAA (ex: 31/12/2026) ou AAAA-MM-DD.'],
    ['- Coluna unidade: g, ml, scoop, capsula, comprimido, etc.'],
    [''],
    ['3. ABA SUPLEMENTOS_SUBSTANCIAS:'],
    ['- Coluna suplemento_nome: deve ser exatamente igual ao nome na aba Suplementos.'],
    ['- Informe a quantidade referente a 1 unidade do suplemento (ex: 1 g ou 1 scoop).']
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instrucoes), 'Instrucoes');

  return wb;
}

export async function baixarModeloExcel() {
  const exemplosIngredientes = [
    {
      nome: 'Sobrecoxa de frango sem osso e sem pele',
      categoria: 'carne_desossada',
      dadosCompletos: true,
      nutrientes100g: {
        kcal: 119,
        proteina: 17.6,
        gordura: 5.0,
        carboidrato: 0,
        fibra: 0,
        calcio: 11,
        fosforo: 165,
        sodio: 86,
        potassio: 230,
        magnesio: 21,
        ferro: 1.0,
        zinco: 1.8
      }
    },
    {
      nome: 'Chuchu cozido',
      categoria: 'vegetal',
      dadosCompletos: true,
      nutrientes100g: {
        kcal: 19,
        proteina: 0.4,
        gordura: 0.1,
        carboidrato: 4.8,
        fibra: 1.0,
        calcio: 12,
        fosforo: 19
      }
    }
  ];

  const exemplosSuplementos = [
    {
      nome: 'Suplemento Nutricional Exemplo',
      marca: 'VetCare',
      lote: 'L2026-01',
      validade: '2026-12-31',
      unidade: 'g',
      substancias: [
        { nome: 'Cálcio', quantidade: 210, unidade: 'mg' },
        { nome: 'Vitamina E', quantidade: 15, unidade: 'UI' },
        { nome: 'Taurina', quantidade: 50, unidade: 'mg' }
      ]
    }
  ];

  const wb = montarWorkbook({
    ingredientes: exemplosIngredientes,
    suplementos: exemplosSuplementos
  });
  await enviarArquivoExcel(wb, 'modelo_meu_pet_chef.xlsx');
}

export async function exportarBancoExcel() {
  const ingredientes = await db.ingredientes.orderBy('nome').toArray();
  const suplementos = await db.suplementos.orderBy('nome').toArray();

  const wb = montarWorkbook({ ingredientes, suplementos });
  const dataHoje = new Date().toISOString().slice(0, 10);
  await enviarArquivoExcel(wb, `banco_meu_pet_chef_${dataHoje}.xlsx`);
}

function extrairNutrientesDaLinha(linhaNormalizada) {
  const nutrientes = {};
  let temAlgumDado = false;

  NUTRIENTES_PADRAO.forEach((n) => {
    const candidatos = [
      normalizarTexto(n.excelCol),
      normalizarTexto(n.key),
      normalizarTexto(n.label),
      normalizarTexto(`${n.label} (${n.unidade})`)
    ];
    let encontrado;
    for (const c of candidatos) {
      if (Object.prototype.hasOwnProperty.call(linhaNormalizada, c)) {
        encontrado = linhaNormalizada[c];
        break;
      }
    }
    const numero = parseNumeroOpcional(encontrado);
    nutrientes[n.key] = numero;
    if (numero !== null) temAlgumDado = true;
  });

  return { nutrientes, temAlgumDado };
}

export async function importarBancoExcel(file, { atualizarExistentes = true } = {}) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const resumo = {
    ingAdicionados: 0,
    ingAtualizados: 0,
    ingIgnorados: 0,
    supAdicionados: 0,
    supAtualizados: 0,
    supIgnorados: 0
  };

  const nomeAbaIng = wb.SheetNames.find((s) => normalizarTexto(s) === 'ingredientes');
  if (nomeAbaIng) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nomeAbaIng], { defval: '' });
    const existentes = await db.ingredientes.toArray();
    const mapaExistentes = new Map(existentes.map((i) => [normalizarTexto(i.nome), i]));

    for (const raw of linhas) {
      const linhaNorm = {};
      Object.keys(raw).forEach((k) => {
        linhaNorm[normalizarTexto(k)] = raw[k];
      });

      const nome = String(linhaNorm.nome || '').trim();
      if (!nome) continue;

      const categoria = resolverCategoria(linhaNorm.categoria);
      const { nutrientes, temAlgumDado } = extrairNutrientesDaLinha(linhaNorm);

      const colCompleto = normalizarTexto(linhaNorm.dados_completos);
      let dadosCompletos = temAlgumDado;
      if (colCompleto === 'nao' || colCompleto === 'não' || colCompleto === 'false' || colCompleto === '0') {
        dadosCompletos = false;
      } else if (colCompleto === 'sim' || colCompleto === 'true' || colCompleto === '1') {
        dadosCompletos = true;
      }

      const payload = {
        nome,
        categoria,
        dadosCompletos,
        nutrientes100g: nutrientes
      };

      const chave = normalizarTexto(nome);
      const jaExiste = mapaExistentes.get(chave);
      if (jaExiste) {
        if (atualizarExistentes) {
          await db.ingredientes.update(jaExiste.id, payload);
          resumo.ingAtualizados++;
        } else {
          resumo.ingIgnorados++;
        }
      } else {
        const novoId = await db.ingredientes.add(payload);
        mapaExistentes.set(chave, { ...payload, id: novoId });
        resumo.ingAdicionados++;
      }
    }
  }

  const mapaSubstancias = new Map();
  const nomeAbaSub = wb.SheetNames.find((s) => normalizarTexto(s).includes('substancia'));
  if (nomeAbaSub) {
    const linhasSub = XLSX.utils.sheet_to_json(wb.Sheets[nomeAbaSub], { defval: '' });
    for (const raw of linhasSub) {
      const linhaNorm = {};
      Object.keys(raw).forEach((k) => {
        linhaNorm[normalizarTexto(k)] = raw[k];
      });
      const supNome = normalizarTexto(linhaNorm.suplemento_nome || linhaNorm.suplemento);
      const substancia = String(linhaNorm.substancia || linhaNorm.nome || '').trim();
      if (!supNome || !substancia) continue;

      const qtd = parseNumeroOpcional(linhaNorm.quantidade) ?? 0;
      const unid = String(linhaNorm.unidade || 'mg').trim();
      const lista = mapaSubstancias.get(supNome) || [];
      lista.push({ nome: substancia, quantidade: qtd, unidade: unid });
      mapaSubstancias.set(supNome, lista);
    }
  }

  const nomeAbaSup = wb.SheetNames.find((s) => normalizarTexto(s) === 'suplementos');
  if (nomeAbaSup) {
    const linhasSup = XLSX.utils.sheet_to_json(wb.Sheets[nomeAbaSup], { defval: '' });
    const existentesSup = await db.suplementos.toArray();
    const mapaSupExistentes = new Map(existentesSup.map((s) => [normalizarTexto(s.nome), s]));

    for (const raw of linhasSup) {
      const linhaNorm = {};
      Object.keys(raw).forEach((k) => {
        linhaNorm[normalizarTexto(k)] = raw[k];
      });

      const nome = String(linhaNorm.nome || '').trim();
      if (!nome) continue;

      const chave = normalizarTexto(nome);
      const jaExiste = mapaSupExistentes.get(chave);
      const substanciasAba = mapaSubstancias.get(chave);

      const payload = {
        nome,
        marca: String(linhaNorm.marca || '').trim(),
        lote: String(linhaNorm.lote || '').trim(),
        validade: parseDataExcel(linhaNorm.validade),
        unidade: String(linhaNorm.unidade || 'g').trim() || 'g',
        fotos: jaExiste?.fotos || [],
        substancias: substanciasAba || jaExiste?.substancias || []
      };

      if (jaExiste) {
        if (atualizarExistentes) {
          await db.suplementos.update(jaExiste.id, payload);
          resumo.supAtualizados++;
        } else {
          resumo.supIgnorados++;
        }
      } else {
        const novoId = await db.suplementos.add(payload);
        mapaSupExistentes.set(chave, { ...payload, id: novoId });
        resumo.supAdicionados++;
      }
    }
  }

  return resumo;
}