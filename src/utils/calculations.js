import { CATEGORIAS_INGREDIENTES, NUTRIENTES_PADRAO } from '../db/database';

export const DIAS_SEMANA = [
  { id: 'seg', label: 'Seg' },
  { id: 'ter', label: 'Ter' },
  { id: 'qua', label: 'Qua' },
  { id: 'qui', label: 'Qui' },
  { id: 'sex', label: 'Sex' },
  { id: 'sab', label: 'Sáb' },
  { id: 'dom', label: 'Dom' }
];

const GRUPOS_DIETA = ['carne_desossada', 'viscera_muscular', 'viscera_secretora', 'vegetal'];

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * 1. Calcula o volume total de refeições por animal e para o evento inteiro
 */
export function calcularResumoAnimais(animais = [], diasDuracao = 1) {
  const dias = Math.max(1, num(diasDuracao));

  const detalhes = animais.map((a) => {
    const refeicoesDia = Math.max(0, num(a.refeicoesDia));
    const pesoRefeicaoG = Math.max(0, num(a.pesoRefeicaoG));
    const totalDiarioG = refeicoesDia * pesoRefeicaoG;
    const totalPeriodoG = totalDiarioG * dias;
    const totalRefeicoesPeriodo = refeicoesDia * dias;

    return {
      ...a,
      refeicoesDia,
      pesoRefeicaoG,
      totalDiarioG,
      totalPeriodoG,
      totalRefeicoesPeriodo
    };
  });

  const totalDiarioGeralG = detalhes.reduce((acc, a) => acc + a.totalDiarioG, 0);
  const totalPeriodoGeralG = detalhes.reduce((acc, a) => acc + a.totalPeriodoG, 0);
  const totalRefeicoesDiaGeral = detalhes.reduce((acc, a) => acc + a.refeicoesDia, 0);
  const totalRefeicoesPeriodoGeral = detalhes.reduce((acc, a) => acc + a.totalRefeicoesPeriodo, 0);

  return {
    numeroAnimais: detalhes.length,
    diasDuracao: dias,
    detalhes,
    totalDiarioGeralG,
    totalPeriodoGeralG,
    totalRefeicoesDiaGeral,
    totalRefeicoesPeriodoGeral
  };
}

/**
 * 2. Compara as porcentagens definidas com as quantidades reais de ingredientes inseridos
 *    Indicando se falta ou sobra em cada grupo de alimento.
 */
export function calcularComparativoGrupos(percentuais = {}, ingredientes = [], totalPeriodoGeralG = 0) {
  const somaPercentuais = GRUPOS_DIETA.reduce((acc, g) => acc + num(percentuais[g]), 0);
  const percentualValido = Math.abs(somaPercentuais - 100) < 0.05;

  const grupos = GRUPOS_DIETA.map((catId) => {
    const metaInfo = CATEGORIAS_INGREDIENTES.find((c) => c.id === catId);
    const pct = num(percentuais[catId]);
    const metaG = (totalPeriodoGeralG * pct) / 100;

    const itensGrupo = ingredientes.filter((ing) => ing.categoria === catId);
    const inseridoG = itensGrupo.reduce((acc, ing) => acc + num(ing.quantidadeG), 0);

    const diferencaG = inseridoG - metaG; // negativo = falta, positivo = sobra
    let status = 'ok';
    if (diferencaG < -0.5) status = 'falta';
    else if (diferencaG > 0.5) status = 'sobra';

    return {
      categoria: catId,
      label: metaInfo?.label || catId,
      percentual: pct,
      metaG,
      inseridoG,
      diferencaG,
      absDiferencaG: Math.abs(diferencaG),
      status,
      qtdItens: itensGrupo.length
    };
  });

  const totalInseridoG = grupos.reduce((acc, g) => acc + g.inseridoG, 0);
  const diferencaTotalG = totalInseridoG - totalPeriodoGeralG;
  let statusTotal = 'ok';
  if (diferencaTotalG < -0.5) statusTotal = 'falta';
  else if (diferencaTotalG > 0.5) statusTotal = 'sobra';

  return {
    somaPercentuais,
    percentualValido,
    grupos,
    totalMetaG: totalPeriodoGeralG,
    totalInseridoG,
    diferencaTotalG,
    absDiferencaTotalG: Math.abs(diferencaTotalG),
    statusTotal
  };
}

/**
 * 3. Analisa validade e doses totais de suplementos no período
 */
export function analisarSuplementos(suplementos = [], dataPreparo = '', diasDuracao = 1, resumoAnimais) {
  const inicio = dataPreparo ? new Date(`${dataPreparo}T00:00:00`) : null;
  const fim = inicio ? new Date(inicio.getTime() + Math.max(1, num(diasDuracao)) * 86400000) : null;
  const refeicoesDia = resumoAnimais?.totalRefeicoesDiaGeral || 0;
  const refeicoesPeriodo = resumoAnimais?.totalRefeicoesPeriodoGeral || 0;

  return suplementos.map((sup) => {
    const qtdPorRef = num(sup.quantidadePorRefeicao);
    let statusValidade = 'ok';
    if (sup.validade && inicio) {
      const valDate = new Date(`${sup.validade}T00:00:00`);
      if (valDate < inicio) statusValidade = 'vencido';
      else if (fim && valDate <= fim) statusValidade = 'vence_no_periodo';
    }

    const substanciasCalculadas = (sup.substancias || []).map((sub) => {
      const porRefeicao = num(sub.quantidade) * qtdPorRef;
      const porDia = porRefeicao * refeicoesDia;
      const porSemana = porDia * 7;
      return {
        ...sub,
        porRefeicao,
        porDia,
        porSemana
      };
    });

    return {
      ...sup,
      qtdPorRefeicao: qtdPorRef,
      qtdDiaria: qtdPorRef * refeicoesDia,
      qtdSemanal: qtdPorRef * refeicoesDia * 7,
      qtdTotalPeriodo: qtdPorRef * refeicoesPeriodo,
      statusValidade,
      substanciasCalculadas
    };
  });
}

/**
 * 4. Busca composição nutricional no banco (se necessário) e calcula
 *    a tabela nutricional por Refeição, Diária e Semanal.
 *    Se algum ingrediente ou avulso não tiver dados completos, avisa exatamente quais faltam.
 */
export function calcularTabelaNutricional({
  ingredientes = [],
  avulsos = [],
  suplementos = [],
  ingredientesDB = [],
  diasDuracao = 1,
  resumoAnimais
}) {
  const dias = Math.max(1, num(diasDuracao));
  const refeicoesDia = resumoAnimais?.totalRefeicoesDiaGeral || 0;
  const itensSemDados = [];

  // Resolve os dados nutricionais procurando no objeto do evento ou no banco interno
  const resolverIngrediente = (item, tipo) => {
    let nutrientes = item.nutrientes100g;
    let completo = Boolean(item.dadosCompletos);

    // Tenta buscar no banco interno por ID ou pelo nome exato
    if (!completo || !nutrientes) {
      const encontrado = ingredientesDB.find(
        (dbItem) =>
          (item.ingredienteId && dbItem.id === item.ingredienteId) ||
          dbItem.nome.trim().toLowerCase() === (item.nome || '').trim().toLowerCase()
      );
      if (encontrado && encontrado.dadosCompletos && encontrado.nutrientes100g) {
        nutrientes = encontrado.nutrientes100g;
        completo = true;
      }
    }

    if (!completo || !nutrientes) {
      itensSemDados.push({ nome: item.nome || '(Sem nome)', tipo });
      return null;
    }

    return nutrientes;
  };

  const criarObjetoVazio = () => {
    const obj = {};
    NUTRIENTES_PADRAO.forEach((n) => {
      obj[n.key] = 0;
    });
    return obj;
  };

  // Totais da comida preparada no período inteiro (para `diasDuracao`)
  const comidaPeriodo = criarObjetoVazio();
  ingredientes.forEach((ing) => {
    const qtd = num(ing.quantidadeG);
    if (qtd <= 0) return;
    const nutr = resolverIngrediente(ing, 'Ingrediente');
    if (!nutr) return;

    NUTRIENTES_PADRAO.forEach((n) => {
      comidaPeriodo[n.key] += (qtd / 100) * num(nutr[n.key]);
    });
  });

  // Totais dos alimentos avulsos NA SEMANA (considerando os dias marcados)
  const avulsosSemanal = criarObjetoVazio();
  avulsos.forEach((av) => {
    const qtd = num(av.quantidadeG);
    const freqSemanal = Array.isArray(av.diasSemana) ? av.diasSemana.length : 0;
    if (qtd <= 0 || freqSemanal <= 0) return;

    const nutr = resolverIngrediente(av, 'Alimento Avulso');
    if (!nutr) return;

    const qtdSemanal = qtd * freqSemanal;
    NUTRIENTES_PADRAO.forEach((n) => {
      avulsosSemanal[n.key] += (qtdSemanal / 100) * num(nutr[n.key]);
    });
  });

  // Agrega substâncias dos suplementos (por refeição, diária, semanal)
  const analiseSups = analisarSuplementos(suplementos, '', dias, resumoAnimais);
  const mapaSubstanciasSup = new Map();
  analiseSups.forEach((sup) => {
    sup.substanciasCalculadas.forEach((sub) => {
      const chave = `${(sub.nome || '').trim().toLowerCase()}__${(sub.unidade || '').trim().toLowerCase()}`;
      if (!sub.nome) return;
      const atual = mapaSubstanciasSup.get(chave) || {
        nome: sub.nome.trim(),
        unidade: sub.unidade || '',
        porRefeicao: 0,
        diaria: 0,
        semanal: 0
      };
      atual.porRefeicao += sub.porRefeicao;
      atual.diaria += sub.porDia;
      atual.semanal += sub.porSemana;
      mapaSubstanciasSup.set(chave, atual);
    });
  });

  if (itensSemDados.length > 0) {
    return {
      completa: false,
      itensSemDados,
      linhas: [],
      substanciasSuplementos: Array.from(mapaSubstanciasSup.values())
    };
  }

  // Consolida: Refeição (da comida preparada), Diária (média com avulsos) e Semanal (7 dias)
  const linhas = NUTRIENTES_PADRAO.map((n) => {
    const comidaDia = comidaPeriodo[n.key] / dias;
    const comidaSemana = comidaDia * 7;
    const avulsoDiaMedia = avulsosSemanal[n.key] / 7;

    const porRefeicao = refeicoesDia > 0 ? comidaDia / refeicoesDia : 0;
    const diaria = comidaDia + avulsoDiaMedia;
    const semanal = comidaSemana + avulsosSemanal[n.key];

    return {
      key: n.key,
      label: n.label,
      unidade: n.unidade,
      porRefeicao,
      diaria,
      semanal
    };
  });

  // Detalhamento por animal individual (caso haja mais de 1 animal com porções diferentes)
  const totalDiarioGeralG = resumoAnimais?.totalDiarioGeralG || 0;
  const porAnimal = (resumoAnimais?.detalhes || []).map((animal) => {
    const proporcao = totalDiarioGeralG > 0 ? animal.totalDiarioG / totalDiarioGeralG : 0;
    const nutrientesAnimal = linhas.map((l) => ({
      ...l,
      porRefeicaoAnimal: animal.refeicoesDia > 0 ? (l.diaria * proporcao) / animal.refeicoesDia : 0,
      diariaAnimal: l.diaria * proporcao,
      semanalAnimal: l.semanal * proporcao
    }));
    return {
      nome: animal.nome,
      refeicoesDia: animal.refeicoesDia,
      pesoRefeicaoG: animal.pesoRefeicaoG,
      nutrientes: nutrientesAnimal
    };
  });

  return {
    completa: true,
    itensSemDados: [],
    linhas,
    porAnimal,
    substanciasSuplementos: Array.from(mapaSubstanciasSup.values())
  };
}
