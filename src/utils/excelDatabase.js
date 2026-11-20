import Dexie from 'dexie';

export const db = new Dexie('MeuPetChefDB');

db.version(1).stores({
  tutores: '++id, nome, telefone',
  animais: '++id, tutorId, nome, especie',
  ingredientes: '++id, nome, categoria',
  suplementos: '++id, nome, marca, validade',
  eventos: '++id, titulo, dataPreparo, tutorId, criadoEm',
  config: 'chave'
});

export const CATEGORIAS_INGREDIENTES = [
  { id: 'carne_desossada', label: 'Carne Desossada', cor: 'bg-tomato/15 text-tomato border-tomato/30' },
  { id: 'viscera_muscular', label: 'Víscera Muscular', cor: 'bg-carrot/15 text-carrot border-carrot/30' },
  { id: 'viscera_secretora', label: 'Víscera Secretora', cor: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  { id: 'vegetal', label: 'Vegetais', cor: 'bg-broccoli/15 text-broccoli border-broccoli/30' },
  { id: 'avulso', label: 'Alimento Avulso', cor: 'bg-chef-500/15 text-chef-700 border-chef-500/30' }
];

export const NUTRIENTES_PADRAO = [
  { key: 'kcal', label: 'Energia', unidade: 'kcal', excelCol: 'energia_kcal' },
  { key: 'proteina', label: 'Proteína', unidade: 'g', excelCol: 'proteina_g' },
  { key: 'gordura', label: 'Lipídios (Gordura)', unidade: 'g', excelCol: 'gordura_g' },
  { key: 'carboidrato', label: 'Carboidrato', unidade: 'g', excelCol: 'carboidrato_g' },
  { key: 'fibra', label: 'Fibra', unidade: 'g', excelCol: 'fibra_g' },
  { key: 'calcio', label: 'Cálcio', unidade: 'mg', excelCol: 'calcio_mg' },
  { key: 'fosforo', label: 'Fósforo', unidade: 'mg', excelCol: 'fosforo_mg' },
  { key: 'sodio', label: 'Sódio', unidade: 'mg', excelCol: 'sodio_mg' },
  { key: 'potassio', label: 'Potássio', unidade: 'mg', excelCol: 'potassio_mg' },
  { key: 'magnesio', label: 'Magnésio', unidade: 'mg', excelCol: 'magnesio_mg' },
  { key: 'ferro', label: 'Ferro', unidade: 'mg', excelCol: 'ferro_mg' },
  { key: 'zinco', label: 'Zinco', unidade: 'mg', excelCol: 'zinco_mg' },
  { key: 'cobre', label: 'Cobre', unidade: 'mg', excelCol: 'cobre_mg' },
  { key: 'vitamina_a', label: 'Vitamina A', unidade: 'UI', excelCol: 'vitamina_a_ui' },
  { key: 'vitamina_d', label: 'Vitamina D', unidade: 'UI', excelCol: 'vitamina_d_ui' },
  { key: 'vitamina_e', label: 'Vitamina E', unidade: 'UI', excelCol: 'vitamina_e_ui' },
  { key: 'vitamina_b12', label: 'Vitamina B12', unidade: 'mcg', excelCol: 'vitamina_b12_mcg' },
  { key: 'taurina', label: 'Taurina', unidade: 'mg', excelCol: 'taurina_mg' }
];

// Popula ingredientes básicos na primeira abertura para facilitar seus testes
export async function inicializarBancoSeVazio() {
  const qtd = await db.ingredientes.count();
  if (qtd > 0) return;

  await db.ingredientes.bulkAdd([
    {
      nome: 'Peito de frango sem osso',
      categoria: 'carne_desossada',
      dadosCompletos: true,
      nutrientes100g: { kcal: 163, proteina: 31.5, gordura: 3.2, carboidrato: 0, fibra: 0, calcio: 7, fosforo: 210, sodio: 65, potassio: 256 }
    },
    {
      nome: 'Patinho bovino moído',
      categoria: 'carne_desossada',
      dadosCompletos: true,
      nutrientes100g: { kcal: 133, proteina: 21.7, gordura: 4.5, carboidrato: 0, fibra: 0, calcio: 4, fosforo: 195, sodio: 58, potassio: 340 }
    },
    {
      nome: 'Coração de frango',
      categoria: 'viscera_muscular',
      dadosCompletos: true,
      nutrientes100g: { kcal: 153, proteina: 15.6, gordura: 9.3, carboidrato: 0.7, fibra: 0, calcio: 12, fosforo: 177, sodio: 82, potassio: 176 }
    },
    {
      nome: 'Moela de frango',
      categoria: 'viscera_muscular',
      dadosCompletos: true,
      nutrientes100g: { kcal: 94, proteina: 17.7, gordura: 2.1, carboidrato: 0, fibra: 0, calcio: 11, fosforo: 148, sodio: 69, potassio: 237 }
    },
    {
      nome: 'Fígado bovino',
      categoria: 'viscera_secretora',
      dadosCompletos: true,
      nutrientes100g: { kcal: 141, proteina: 20.7, gordura: 5.4, carboidrato: 1.1, fibra: 0, calcio: 4, fosforo: 356, sodio: 73, potassio: 313, vitamina_a: 16898 }
    },
    {
      nome: 'Abobrinha cozida',
      categoria: 'vegetal',
      dadosCompletos: true,
      nutrientes100g: { kcal: 15, proteina: 1.1, gordura: 0.2, carboidrato: 3.0, fibra: 1.4, calcio: 17, fosforo: 26, sodio: 2, potassio: 152 }
    },
    {
      nome: 'Cenoura cozida',
      categoria: 'vegetal',
      dadosCompletos: true,
      nutrientes100g: { kcal: 30, proteina: 0.8, gordura: 0.2, carboidrato: 6.7, fibra: 2.6, calcio: 26, fosforo: 25, sodio: 28, potassio: 195, vitamina_a: 17033 }
    },
    {
      nome: 'Ovo de galinha cozido',
      categoria: 'avulso',
      dadosCompletos: true,
      nutrientes100g: { kcal: 146, proteina: 13.3, gordura: 9.5, carboidrato: 0.6, fibra: 0, calcio: 49, fosforo: 196, sodio: 146, potassio: 126 }
    }
  ]);

  await db.config.put({
    chave: 'responsavelPadrao',
    nome: '',
    crmv: ''
  });
}