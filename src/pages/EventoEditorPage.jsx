import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Users,
  PawPrint,
  Droplets,
  Pill,
  Utensils,
  Camera,
  X,
  FileText,
  FileSpreadsheet,
  FileType,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';
import { db, CATEGORIAS_INGREDIENTES } from '../db/database';
import { comprimirImagem } from '../utils/imageHelper';
import {
  DIAS_SEMANA,
  calcularResumoAnimais,
  calcularComparativoGrupos,
  analisarSuplementos,
  calcularTabelaNutricional
} from '../utils/calculations';
import { exportarPDF, exportarDOCX, exportarXLSX } from '../utils/exporters';

const ETAPAS = [
  { id: 0, label: '1. Geral & Pets' },
  { id: 1, label: '2. Grupos (%)' },
  { id: 2, label: '3. Ingredientes' },
  { id: 3, label: '4. Supl. & Avulsos' },
  { id: 4, label: '5. Nutrição & Exportar' }
];

const hojeISO = () => new Date().toISOString().slice(0, 10);

export default function EventoEditorPage({ eventoInicial, onVoltar, onSalvo }) {
  const tutoresDB = useLiveQuery(() => db.tutores.orderBy('nome').toArray(), []) || [];
  const animaisDB = useLiveQuery(() => db.animais.orderBy('nome').toArray(), []) || [];
  const ingredientesDB = useLiveQuery(() => db.ingredientes.orderBy('nome').toArray(), []) || [];
  const suplementosDB = useLiveQuery(() => db.suplementos.orderBy('nome').toArray(), []) || [];
  const configResp = useLiveQuery(() => db.config.get('responsavelPadrao'), []);

  const [etapa, setEtapa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState('');

  const [evento, setEvento] = useState(() => {
    if (eventoInicial) return eventoInicial;
    return {
      titulo: '',
      dataPreparo: hojeISO(),
      diasDuracao: 7,
      tutorId: '',
      tutorNome: '',
      tutorFoto: '',
      responsavelTecnico: '',
      crmv: '',
      animais: [],
      percentuais: {
        carne_desossada: 50,
        viscera_muscular: 25,
        viscera_secretora: 10,
        vegetal: 15
      },
      ingredientes: [],
      aguaMl: 0,
      suplementos: [],
      avulsos: [],
      observacoes: ''
    };
  });

  // Preenche o responsável técnico padrão caso seja um evento novo
  useEffect(() => {
    if (!eventoInicial && configResp && !evento.responsavelTecnico) {
      setEvento((p) => ({
        ...p,
        responsavelTecnico: configResp.nome || '',
        crmv: configResp.crmv || ''
      }));
    }
  }, [configResp, eventoInicial]);

  // Cálculos em tempo real
  const resumoAnimais = useMemo(
    () => calcularResumoAnimais(evento.animais, evento.diasDuracao),
    [evento.animais, evento.diasDuracao]
  );

  const comparativo = useMemo(
    () =>
      calcularComparativoGrupos(
        evento.percentuais,
        evento.ingredientes,
        resumoAnimais.totalPeriodoGeralG
      ),
    [evento.percentuais, evento.ingredientes, resumoAnimais.totalPeriodoGeralG]
  );

  const analiseSups = useMemo(
    () =>
      analisarSuplementos(
        evento.suplementos,
        evento.dataPreparo,
        evento.diasDuracao,
        resumoAnimais
      ),
    [evento.suplementos, evento.dataPreparo, evento.diasDuracao, resumoAnimais]
  );

  const tabelaNutricional = useMemo(
    () =>
      calcularTabelaNutricional({
        ingredientes: evento.ingredientes,
        avulsos: evento.avulsos,
        suplementos: evento.suplementos,
        ingredientesDB,
        diasDuracao: evento.diasDuracao,
        resumoAnimais
      }),
    [evento.ingredientes, evento.avulsos, evento.suplementos, ingredientesDB, evento.diasDuracao, resumoAnimais]
  );

  /* ---------- Handlers Gerais ---------- */
  const selecionarTutorDB = (tutorId) => {
    if (!tutorId) {
      setEvento((p) => ({ ...p, tutorId: '', tutorNome: '', tutorFoto: '' }));
      return;
    }
    const t = tutoresDB.find((x) => x.id === Number(tutorId));
    if (t) {
      setEvento((p) => ({
        ...p,
        tutorId: t.id,
        tutorNome: t.nome,
        tutorFoto: t.foto || ''
      }));
    }
  };

  const salvarEvento = async () => {
    if (evento.animais.length === 0) {
      alert('Adicione pelo menos 1 animal antes de salvar o cardápio.');
      setEtapa(0);
      return;
    }
    setSalvando(true);
    try {
      const agora = new Date().toISOString();
      const tituloFinal =
        evento.titulo?.trim() ||
        `Cardápio ${evento.animais.map((a) => a.nome).filter(Boolean).join(' & ') || 'Pets'}`;

      const payload = {
        ...evento,
        titulo: tituloFinal,
        diasDuracao: Number(evento.diasDuracao) || 1,
        aguaMl: Number(evento.aguaMl) || 0,
        atualizadoEm: agora,
        criadoEm: evento.criadoEm || agora
      };

      if (evento.id) {
        await db.eventos.update(evento.id, payload);
      } else {
        const novoId = await db.eventos.add(payload);
        setEvento((p) => ({ ...p, id: novoId, titulo: tituloFinal }));
      }
      onSalvo?.();
    } finally {
      setSalvando(false);
    }
  };

  const handleExportar = async (tipo) => {
    setExportando(tipo);
    try {
      const dadosCompletos = {
        evento,
        resumoAnimais,
        comparativo,
        analiseSups,
        tabelaNutricional
      };
      if (tipo === 'pdf') await exportarPDF(dadosCompletos);
      if (tipo === 'docx') await exportarDOCX(dadosCompletos);
      if (tipo === 'xlsx') await exportarXLSX(dadosCompletos);
    } catch (err) {
      console.error(err);
      alert(`Erro ao gerar ${tipo.toUpperCase()}: ${err.message || err}`);
    } finally {
      setExportando('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra superior do Editor */}
      <div className="flex items-center justify-between gap-2 bg-white/95 p-3 rounded-2xl shadow-sm border border-chef-100">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1 text-sm font-bold text-chef-700 hover:bg-chef-50 px-2.5 py-1.5 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="text-center min-w-0 flex-1">
          <p className="text-xs font-bold text-chef-500 uppercase tracking-wide">
            {evento.id ? 'Editando Evento' : 'Novo Evento'}
          </p>
          <p className="text-sm font-extrabold text-chef-900 truncate">
            {evento.titulo || 'Cardápio Pet'}
          </p>
        </div>
        <button
          onClick={salvarEvento}
          disabled={salvando}
          className="flex items-center gap-1.5 bg-broccoli hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow active:scale-95 transition"
        >
          <Save className="w-4 h-4" />
          {salvando ? '...' : 'Salvar'}
        </button>
      </div>

      {/* Navegação das 5 Etapas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {ETAPAS.map((e) => (
          <button
            key={e.id}
            onClick={() => setEtapa(e.id)}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition ${
              etapa === e.id
                ? 'bg-chef-500 text-white border-chef-500 shadow-sm'
                : 'bg-white/90 text-chef-700 border-chef-200 hover:bg-chef-50'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* ETAPA 1: GERAL & ANIMAIS */}
      {etapa === 0 && (
        <EtapaGeralAnimais
          evento={evento}
          setEvento={setEvento}
          tutoresDB={tutoresDB}
          animaisDB={animaisDB}
          selecionarTutorDB={selecionarTutorDB}
          resumoAnimais={resumoAnimais}
        />
      )}

      {/* ETAPA 2: GRUPOS & PORCENTAGENS */}
      {etapa === 1 && (
        <EtapaPercentuais
          evento={evento}
          setEvento={setEvento}
          comparativo={comparativo}
          resumoAnimais={resumoAnimais}
        />
      )}

      {/* ETAPA 3: INGREDIENTES & ÁGUA */}
      {etapa === 2 && (
        <EtapaIngredientes
          evento={evento}
          setEvento={setEvento}
          ingredientesDB={ingredientesDB}
          comparativo={comparativo}
        />
      )}

      {/* ETAPA 4: SUPLEMENTOS & AVULSOS */}
      {etapa === 3 && (
        <EtapaSuplementosAvulsos
          evento={evento}
          setEvento={setEvento}
          suplementosDB={suplementosDB}
          ingredientesDB={ingredientesDB}
          analiseSups={analiseSups}
        />
      )}

      {/* ETAPA 5: NUTRIÇÃO & EXPORTAÇÃO */}
      {etapa === 4 && (
        <EtapaResumoExportar
          evento={evento}
          resumoAnimais={resumoAnimais}
          comparativo={comparativo}
          analiseSups={analiseSups}
          tabelaNutricional={tabelaNutricional}
          exportando={exportando}
          onExportar={handleExportar}
          onSalvar={salvarEvento}
        />
      )}

      {/* Botões de navegação Anterior / Próxima etapa */}
      <div className="flex justify-between gap-3 pt-1">
        <button
          disabled={etapa === 0}
          onClick={() => setEtapa((e) => Math.max(0, e - 1))}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-white border border-chef-200 text-chef-700 text-xs font-bold disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        {etapa < 4 ? (
          <button
            onClick={() => setEtapa((e) => Math.min(4, e + 1))}
            className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-chef-500 text-white text-xs font-bold shadow"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={salvarEvento}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-broccoli text-white text-xs font-bold shadow"
          >
            <Save className="w-4 h-4" /> Concluir & Arquivar
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   ETAPA 1: DADOS GERAIS, TUTOR, RESPONSÁVEL TÉCNICO E PETS
========================================================= */
function EtapaGeralAnimais({
  evento,
  setEvento,
  tutoresDB,
  animaisDB,
  selecionarTutorDB,
  resumoAnimais
}) {
  const [animalSelectId, setAnimalSelectId] = useState('');

  const addAnimalDoBanco = () => {
    if (!animalSelectId) return;
    const pet = animaisDB.find((a) => a.id === Number(animalSelectId));
    if (!pet) return;
    setEvento((p) => ({
      ...p,
      animais: [
        ...p.animais,
        {
          animalId: pet.id,
          nome: pet.nome,
          idade: pet.idade || '',
          sexo: pet.sexo || 'Macho',
          foto: pet.foto || '',
          refeicoesDia: 2,
          pesoRefeicaoG: 150
        }
      ]
    }));
    setAnimalSelectId('');
  };

  const addAnimalManual = () => {
    setEvento((p) => ({
      ...p,
      animais: [
        ...p.animais,
        {
          animalId: null,
          nome: '',
          idade: '',
          sexo: 'Macho',
          foto: '',
          refeicoesDia: 2,
          pesoRefeicaoG: 150
        }
      ]
    }));
  };

  const editAnimal = (idx, campo, valor) => {
    setEvento((p) => {
      const copia = [...p.animais];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return { ...p, animais: copia };
    });
  };

  const removerAnimal = (idx) => {
    setEvento((p) => ({ ...p, animais: p.animais.filter((_, i) => i !== idx) }));
  };

  const fotoAnimalManual = async (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await comprimirImagem(file, 400);
    editAnimal(idx, 'foto', base64);
  };

  return (
    <div className="space-y-4">
      <CardSecao titulo="Dados do Evento (Cardápio)">
        <div className="space-y-3">
          <div>
            <label className="label-campo">Título / Identificação do Cardápio</label>
            <input
              type="text"
              placeholder="Ex: Dieta Outubro - Thor & Luna"
              value={evento.titulo}
              onChange={(e) => setEvento({ ...evento, titulo: e.target.value })}
              className="input-campo"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="label-campo">Data do Preparo</label>
              <input
                type="date"
                value={evento.dataPreparo}
                onChange={(e) => setEvento({ ...evento, dataPreparo: e.target.value })}
                className="input-campo"
              />
            </div>
            <div>
              <label className="label-campo">Para quantos dias?</label>
              <input
                type="number"
                min="1"
                value={evento.diasDuracao}
                onChange={(e) => setEvento({ ...evento, diasDuracao: e.target.value })}
                className="input-campo"
              />
            </div>
          </div>
        </div>
      </CardSecao>

      <CardSecao titulo="Tutores e Responsável Técnico">
        <div className="space-y-3">
          <div>
            <label className="label-campo">Puxar Tutor do Banco de Dados</label>
            <select
              value={evento.tutorId}
              onChange={(e) => selecionarTutorDB(e.target.value)}
              className="input-campo"
            >
              <option value="">-- Digitar manualmente ou escolher --</option>
              {tutoresDB.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {evento.tutorFoto ? (
              <img
                src={evento.tutorFoto}
                alt="Tutor"
                className="w-11 h-11 rounded-full object-cover border border-chef-200 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-chef-100 text-chef-600 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <label className="label-campo">Nome do(s) Tutor(es)</label>
              <input
                type="text"
                placeholder="Nome do tutor"
                value={evento.tutorNome}
                onChange={(e) => setEvento({ ...evento, tutorNome: e.target.value })}
                className="input-campo"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="label-campo">Responsável Técnico</label>
              <input
                type="text"
                placeholder="Nome do profissional"
                value={evento.responsavelTecnico}
                onChange={(e) => setEvento({ ...evento, responsavelTecnico: e.target.value })}
                className="input-campo"
              />
            </div>
            <div>
              <label className="label-campo">CRMV / Reg.</label>
              <input
                type="text"
                placeholder="Ex: SP-1234"
                value={evento.crmv}
                onChange={(e) => setEvento({ ...evento, crmv: e.target.value })}
                className="input-campo"
              />
            </div>
          </div>
        </div>
      </CardSecao>

      <CardSecao titulo={`Animais do Evento (${resumoAnimais.numeroAnimais})`}>
        <div className="space-y-3">
          {/* Adicionar do banco ou manual */}
          <div className="flex gap-2">
            <select
              value={animalSelectId}
              onChange={(e) => setAnimalSelectId(e.target.value)}
              className="input-campo flex-1"
            >
              <option value="">-- Selecionar pet cadastrado --</option>
              {animaisDB.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} ({a.sexo}, {a.idade || 's/ idade'})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addAnimalDoBanco}
              className="px-3 py-2 bg-chef-500 text-white rounded-xl text-xs font-bold shrink-0"
            >
              + Puxar
            </button>
          </div>

          <button
            type="button"
            onClick={addAnimalManual}
            className="w-full py-2 border-2 border-dashed border-chef-300 text-chef-700 rounded-xl text-xs font-bold hover:bg-chef-50 flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Adicionar Animal Manualmente
          </button>

          {evento.animais.map((pet, idx) => {
            const det = resumoAnimais.detalhes[idx];
            return (
              <div key={idx} className="p-3 rounded-2xl bg-chef-50/80 border border-chef-200 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <label className="cursor-pointer shrink-0">
                    {pet.foto ? (
                      <img src={pet.foto} alt={pet.nome} className="w-12 h-12 rounded-xl object-cover border border-chef-300" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white text-chef-500 flex items-center justify-center border border-chef-200">
                        <PawPrint className="w-5 h-5" />
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => fotoAnimalManual(idx, e)} />
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do animal *"
                    value={pet.nome}
                    onChange={(e) => editAnimal(idx, 'nome', e.target.value)}
                    className="input-campo flex-1 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => removerAnimal(idx)}
                    className="p-2 text-tomato hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-campo">Idade</label>
                    <input
                      type="text"
                      placeholder="Ex: 4 anos"
                      value={pet.idade}
                      onChange={(e) => editAnimal(idx, 'idade', e.target.value)}
                      className="input-campo"
                    />
                  </div>
                  <div>
                    <label className="label-campo">Sexo</label>
                    <select
                      value={pet.sexo}
                      onChange={(e) => editAnimal(idx, 'sexo', e.target.value)}
                      className="input-campo"
                    >
                      <option value="Macho">Macho</option>
                      <option value="Fêmea">Fêmea</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label-campo">Refeições ao dia</label>
                    <input
                      type="number"
                      min="1"
                      value={pet.refeicoesDia}
                      onChange={(e) => editAnimal(idx, 'refeicoesDia', e.target.value)}
                      className="input-campo"
                    />
                  </div>
                  <div>
                    <label className="label-campo">Peso cada refeição (g)</label>
                    <input
                      type="number"
                      min="1"
                      value={pet.pesoRefeicaoG}
                      onChange={(e) => editAnimal(idx, 'pesoRefeicaoG', e.target.value)}
                      className="input-campo"
                    />
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-chef-700 bg-white/90 px-3 py-1.5 rounded-lg flex justify-between">
                  <span>Diário: {det?.totalDiarioG.toFixed(0)} g</span>
                  <span>Total ({resumoAnimais.diasDuracao} dias): {det?.totalPeriodoG.toFixed(0)} g</span>
                </div>
              </div>
            );
          })}

          {evento.animais.length > 0 && (
            <div className="bg-chef-600 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[11px] opacity-85">Volume Total do Preparo ({resumoAnimais.diasDuracao} dias)</p>
                <p className="text-lg font-extrabold">{resumoAnimais.totalPeriodoGeralG.toFixed(0)} g</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] opacity-85">Total Diário</p>
                <p className="text-sm font-bold">{resumoAnimais.totalDiarioGeralG.toFixed(0)} g/dia</p>
              </div>
            </div>
          )}
        </div>
      </CardSecao>
    </div>
  );
}

/* =========================================================
   ETAPA 2: DEFINIÇÃO DOS GRUPOS E PORCENTAGENS
========================================================= */
function EtapaPercentuais({ evento, setEvento, comparativo, resumoAnimais }) {
  const atualizarPct = (cat, val) => {
    setEvento((p) => ({
      ...p,
      percentuais: { ...p.percentuais, [cat]: parseFloat(val) || 0 }
    }));
  };

  return (
    <div className="space-y-4">
      <CardSecao titulo="Proporção dos Grupos de Alimentos">
        <p className="text-xs text-chef-600 mb-3">
          Defina a porcentagem de cada grupo para calcular a meta exata em gramas sobre o total do preparo (
          <strong>{resumoAnimais.totalPeriodoGeralG.toFixed(0)} g</strong>).
        </p>

        <div className="space-y-3">
          {comparativo.grupos.map((g) => (
            <div key={g.categoria} className="p-3 rounded-xl bg-chef-50/70 border border-chef-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-chef-900">{g.label}</span>
                <span className="text-xs font-bold text-chef-600">Meta: {g.metaG.toFixed(1)} g</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={evento.percentuais[g.categoria]}
                  onChange={(e) => atualizarPct(g.categoria, e.target.value)}
                  className="input-campo w-28 font-bold text-center"
                />
                <span className="text-sm font-bold text-chef-700">%</span>
                <div className="flex-1 bg-white h-2.5 rounded-full overflow-hidden border border-chef-200">
                  <div
                    className="h-full bg-chef-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, g.percentual))}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`mt-4 p-3 rounded-xl flex items-center justify-between text-sm font-bold border ${
            comparativo.percentualValido
              ? 'bg-emerald-50 text-broccoli border-emerald-200'
              : 'bg-red-50 text-tomato border-red-200'
          }`}
        >
          <span>Soma das porcentagens:</span>
          <span>
            {comparativo.somaPercentuais.toFixed(1)}% {comparativo.percentualValido ? '✓' : '(Deve fechar 100%)'}
          </span>
        </div>
      </CardSecao>
    </div>
  );
}

/* =========================================================
   ETAPA 3: INGREDIENTES POR CATEGORIA, ÁGUA E SALDO FALTA/SOBRA
========================================================= */
function EtapaIngredientes({ evento, setEvento, ingredientesDB, comparativo }) {
  const [modalManualCat, setModalManualCat] = useState(null);

  const adicionarDoBanco = (categoria, ingId) => {
    if (!ingId) return;
    const item = ingredientesDB.find((i) => i.id === Number(ingId));
    if (!item) return;
    setEvento((p) => ({
      ...p,
      ingredientes: [
        ...p.ingredientes,
        {
          ingredienteId: item.id,
          nome: item.nome,
          categoria,
          quantidadeG: 0,
          dadosCompletos: item.dadosCompletos,
          nutrientes100g: item.nutrientes100g
        }
      ]
    }));
  };

  const atualizarQtd = (idx, val) => {
    setEvento((p) => {
      const copia = [...p.ingredientes];
      copia[idx] = { ...copia[idx], quantidadeG: parseFloat(val) || 0 };
      return { ...p, ingredientes: copia };
    });
  };

  const removerIng = (idx) => {
    setEvento((p) => ({ ...p, ingredientes: p.ingredientes.filter((_, i) => i !== idx) }));
  };

  const adicionarManual = async ({ nome, quantidadeG, salvarNoBanco }) => {
    let novoId = null;
    if (salvarNoBanco) {
      novoId = await db.ingredientes.add({
        nome,
        categoria: modalManualCat,
        dadosCompletos: false,
        nutrientes100g: {}
      });
    }
    setEvento((p) => ({
      ...p,
      ingredientes: [
        ...p.ingredientes,
        {
          ingredienteId: novoId,
          nome,
          categoria: modalManualCat,
          quantidadeG: parseFloat(quantidadeG) || 0,
          dadosCompletos: false,
          nutrientes100g: null
        }
      ]
    }));
    setModalManualCat(null);
  };

  return (
    <div className="space-y-4">
      {/* Placar Geral Falta / Sobra */}
      <div className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-chef-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-chef-600 font-semibold">Total Inserido / Meta do Preparo</p>
          <p className="text-base font-extrabold text-chef-900">
            {comparativo.totalInseridoG.toFixed(0)} g / {comparativo.totalMetaG.toFixed(0)} g
          </p>
        </div>
        <BadgeSaldo status={comparativo.statusTotal} diff={comparativo.absDiferencaTotalG} />
      </div>

      {/* Blocos por Grupo de Alimento */}
      {comparativo.grupos.map((grupo) => {
        const opcoesDB = ingredientesDB.filter((i) => i.categoria === grupo.categoria);
        const itensComIndex = evento.ingredientes
          .map((ing, idx) => ({ ...ing, _idx: idx }))
          .filter((ing) => ing.categoria === grupo.categoria);

        return (
          <CardSecao key={grupo.categoria} titulo={grupo.label}>
            <div className="flex items-center justify-between text-xs mb-3 bg-chef-50 p-2.5 rounded-xl border border-chef-100">
              <span>
                Meta ({grupo.percentual}%): <strong>{grupo.metaG.toFixed(1)} g</strong> • Inserido:{' '}
                <strong>{grupo.inseridoG.toFixed(1)} g</strong>
              </span>
              <BadgeSaldo status={grupo.status} diff={grupo.absDiferencaG} />
            </div>

            <div className="space-y-2 mb-3">
              {itensComIndex.map((ing) => (
                <div
                  key={ing._idx}
                  className="flex items-center gap-2 bg-white p-2 rounded-xl border border-chef-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-chef-900 truncate">{ing.nome}</p>
                    {!ing.dadosCompletos && (
                      <span className="text-[10px] text-carrot font-semibold">Sem tabela nutricional</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={ing.quantidadeG || ''}
                      placeholder="0"
                      onChange={(e) => atualizarQtd(ing._idx, e.target.value)}
                      className="w-20 px-2 py-1.5 border border-chef-200 rounded-lg text-xs font-bold text-right"
                    />
                    <span className="text-xs font-semibold text-chef-600">g</span>
                  </div>
                  <button onClick={() => removerIng(ing._idx)} className="p-1.5 text-tomato">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <select
                value=""
                onChange={(e) => adicionarDoBanco(grupo.categoria, e.target.value)}
                className="input-campo flex-1 text-xs"
              >
                <option value="">+ Puxar {grupo.label} do banco...</option>
                {opcoesDB.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nome} {!op.dadosCompletos ? '(sem nutr.)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setModalManualCat(grupo.categoria)}
                className="px-3 py-2 bg-chef-100 text-chef-800 rounded-xl text-xs font-bold shrink-0"
              >
                + Manual
              </button>
            </div>
          </CardSecao>
        );
      })}

      {/* Água no preparo */}
      <CardSecao titulo="Água no Preparo">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Droplets className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <label className="label-campo">Quantidade de Água (ml)</label>
            <input
              type="number"
              min="0"
              value={evento.aguaMl}
              onChange={(e) => setEvento({ ...evento, aguaMl: e.target.value })}
              className="input-campo"
            />
          </div>
        </div>
      </CardSecao>

      {modalManualCat && (
        <ModalIngredienteManual
          categoria={modalManualCat}
          onClose={() => setModalManualCat(null)}
          onConfirmar={adicionarManual}
        />
      )}
    </div>
  );
}

/* =========================================================
   ETAPA 4: SUPLEMENTOS, AVULSOS E OBSERVAÇÕES
========================================================= */
function EtapaSuplementosAvulsos({
  evento,
  setEvento,
  suplementosDB,
  ingredientesDB,
  analiseSups
}) {
  const [supManualAberto, setSupManualAberto] = useState(false);

  const puxarSuplementoDB = (supId) => {
    if (!supId) return;
    const s = suplementosDB.find((x) => x.id === Number(supId));
    if (!s) return;
    setEvento((p) => ({
      ...p,
      suplementos: [
        ...p.suplementos,
        {
          suplementoId: s.id,
          nome: s.nome,
          marca: s.marca || '',
          lote: s.lote || '',
          validade: s.validade || '',
          unidade: s.unidade || 'g',
          quantidadePorRefeicao: 1,
          fotos: s.fotos || [],
          substancias: s.substancias || []
        }
      ]
    }));
  };

  const editSup = (idx, campo, valor) => {
    setEvento((p) => {
      const copia = [...p.suplementos];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return { ...p, suplementos: copia };
    });
  };

  const removerSup = (idx) => {
    setEvento((p) => ({ ...p, suplementos: p.suplementos.filter((_, i) => i !== idx) }));
  };

  // Avulsos
  const avulsosDB = ingredientesDB.filter((i) => i.categoria === 'avulso');

  const puxarAvulsoDB = (id) => {
    if (!id) return;
    const item = ingredientesDB.find((i) => i.id === Number(id));
    if (!item) return;
    setEvento((p) => ({
      ...p,
      avulsos: [
        ...p.avulsos,
        {
          ingredienteId: item.id,
          nome: item.nome,
          quantidadeG: 30,
          diasSemana: ['seg', 'qua', 'sex'],
          dadosCompletos: item.dadosCompletos,
          nutrientes100g: item.nutrientes100g
        }
      ]
    }));
  };

  const addAvulsoManual = () => {
    setEvento((p) => ({
      ...p,
      avulsos: [
        ...p.avulsos,
        {
          ingredienteId: null,
          nome: '',
          quantidadeG: 20,
          diasSemana: ['seg', 'qui'],
          dadosCompletos: false,
          nutrientes100g: null
        }
      ]
    }));
  };

  const toggleDiaAvulso = (idx, diaId) => {
    setEvento((p) => {
      const copia = [...p.avulsos];
      const atuais = copia[idx].diasSemana || [];
      copia[idx] = {
        ...copia[idx],
        diasSemana: atuais.includes(diaId) ? atuais.filter((d) => d !== diaId) : [...atuais, diaId]
      };
      return { ...p, avulsos: copia };
    });
  };

  const editAvulso = (idx, campo, valor) => {
    setEvento((p) => {
      const copia = [...p.avulsos];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return { ...p, avulsos: copia };
    });
  };

  const removerAvulso = (idx) => {
    setEvento((p) => ({ ...p, avulsos: p.avulsos.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-4">
      {/* SUPLEMENTOS */}
      <CardSecao titulo="Suplementos">
        <div className="flex gap-2 mb-3">
          <select value="" onChange={(e) => puxarSuplementoDB(e.target.value)} className="input-campo flex-1 text-xs">
            <option value="">+ Puxar suplemento cadastrado...</option>
            {suplementosDB.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} ({s.marca || 's/ marca'})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSupManualAberto(true)}
            className="px-3 py-2 bg-chef-100 text-chef-800 rounded-xl text-xs font-bold shrink-0"
          >
            + Manual
          </button>
        </div>

        <div className="space-y-3">
          {evento.suplementos.map((sup, idx) => {
            const analise = analiseSups[idx];
            return (
              <div key={idx} className="p-3 rounded-2xl bg-chef-50/70 border border-chef-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {sup.fotos?.[0] ? (
                      <img src={sup.fotos[0]} alt={sup.nome} className="w-11 h-11 rounded-xl object-cover border" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white text-chef-600 flex items-center justify-center border">
                        <Pill className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-chef-900">{sup.nome}</p>
                      <p className="text-[11px] text-chef-600">
                        Marca: {sup.marca || '-'} • Lote: {sup.lote || '-'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removerSup(idx)} className="text-tomato p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {analise?.statusValidade === 'vencido' && (
                  <div className="text-xs bg-red-50 text-tomato border border-red-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Atenção: Suplemento vencido para a data do preparo!
                  </div>
                )}
                {analise?.statusValidade === 'vence_no_periodo' && (
                  <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Validade expira durante o período deste cardápio.
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label-campo">Qtd / Refeição ({sup.unidade})</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sup.quantidadePorRefeicao}
                      onChange={(e) => editSup(idx, 'quantidadePorRefeicao', e.target.value)}
                      className="input-campo font-bold"
                    />
                  </div>
                  <div>
                    <label className="label-campo">Lote</label>
                    <input
                      type="text"
                      value={sup.lote}
                      onChange={(e) => editSup(idx, 'lote', e.target.value)}
                      className="input-campo"
                    />
                  </div>
                  <div>
                    <label className="label-campo">Validade</label>
                    <input
                      type="date"
                      value={sup.validade}
                      onChange={(e) => editSup(idx, 'validade', e.target.value)}
                      className="input-campo"
                    />
                  </div>
                </div>

                {(sup.substancias || []).length > 0 && (
                  <div className="text-[11px] text-chef-700 bg-white px-2.5 py-1.5 rounded-lg border border-chef-100">
                    <strong>Rótulo:</strong>{' '}
                    {sup.substancias.map((s) => `${s.nome} (${s.quantidade}${s.unidade}/${sup.unidade})`).join(' • ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardSecao>

      {/* ALIMENTOS AVULSOS */}
      <CardSecao titulo="Alimentos Ofertados Avulso (fora da comida)">
        <div className="flex gap-2 mb-3">
          <select value="" onChange={(e) => puxarAvulsoDB(e.target.value)} className="input-campo flex-1 text-xs">
            <option value="">+ Puxar alimento avulso do banco...</option>
            {avulsosDB.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addAvulsoManual}
            className="px-3 py-2 bg-chef-100 text-chef-800 rounded-xl text-xs font-bold shrink-0"
          >
            + Manual
          </button>
        </div>

        <div className="space-y-3">
          {evento.avulsos.map((av, idx) => (
            <div key={idx} className="p-3 rounded-2xl bg-chef-50/70 border border-chef-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome do alimento avulso"
                  value={av.nome}
                  onChange={(e) => editAvulso(idx, 'nome', e.target.value)}
                  className="input-campo flex-1 font-bold"
                />
                <input
                  type="number"
                  min="0"
                  value={av.quantidadeG}
                  onChange={(e) => editAvulso(idx, 'quantidadeG', e.target.value)}
                  className="input-campo w-20 text-right font-bold"
                />
                <span className="text-xs font-bold text-chef-600">g</span>
                <button onClick={() => removerAvulso(idx)} className="text-tomato p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-[11px] font-bold text-chef-700 mb-1">
                  Frequência ({(av.diasSemana || []).length}x na semana):
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {DIAS_SEMANA.map((d) => {
                    const marcado = (av.diasSemana || []).includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDiaAvulso(idx, d.id)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold border ${
                          marcado
                            ? 'bg-chef-500 text-white border-chef-500'
                            : 'bg-white text-chef-600 border-chef-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardSecao>

      {/* OBSERVAÇÕES */}
      <CardSecao titulo="Observações e Modo de Preparo">
        <textarea
          rows={3}
          placeholder="Instruções de cozimento, porcionamento, congelamento, transição alimentar..."
          value={evento.observacoes}
          onChange={(e) => setEvento({ ...evento, observacoes: e.target.value })}
          className="input-campo"
        />
      </CardSecao>

      {supManualAberto && (
        <ModalSuplementoManual
          onClose={() => setSupManualAberto(false)}
          onConfirmar={async (novoSup, salvarNoBanco) => {
            if (salvarNoBanco) {
              const id = await db.suplementos.add(novoSup);
              novoSup.suplementoId = id;
            }
            setEvento((p) => ({ ...p, suplementos: [...p.suplementos, novoSup] }));
            setSupManualAberto(false);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   ETAPA 5: TABELA NUTRICIONAL & EXPORTAÇÃO
========================================================= */
function EtapaResumoExportar({
  evento,
  resumoAnimais,
  comparativo,
  analiseSups,
  tabelaNutricional,
  exportando,
  onExportar
}) {
  return (
    <div className="space-y-4">
      {/* Status do Balanceamento */}
      <CardSecao titulo="Conferência dos Grupos">
        <div className="space-y-1.5">
          {comparativo.grupos.map((g) => (
            <div key={g.categoria} className="flex items-center justify-between text-xs py-1 border-b border-chef-50 last:border-0">
              <span className="font-semibold text-chef-800">
                {g.label} ({g.percentual}%)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-chef-600">
                  {g.inseridoG.toFixed(0)}g / {g.metaG.toFixed(0)}g
                </span>
                <BadgeSaldo status={g.status} diff={g.absDiferencaG} />
              </div>
            </div>
          ))}
        </div>
      </CardSecao>

      {/* Tabela Nutricional */}
      <CardSecao titulo="Tabela Nutricional Calculada">
        {!tabelaNutricional.completa ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Faltam dados nutricionais para compor a tabela completa!</span>
            </div>
            <p className="text-xs text-amber-700">
              Complete a composição nutricional no <strong>Banco de Dados</strong> para os seguintes itens:
            </p>
            <ul className="list-disc pl-5 text-xs font-semibold text-amber-900 space-y-0.5">
              {tabelaNutricional.itensSemDados.map((it, i) => (
                <li key={i}>
                  {it.nome} ({it.tipo})
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-chef-600">
              * Valores calculados considerando comida preparada ({resumoAnimais.diasDuracao} dias) + alimentos avulsos intercalados na semana.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-chef-500 text-white">
                    <th className="text-left p-2 rounded-tl-xl">Nutriente</th>
                    <th className="text-right p-2">Refeição</th>
                    <th className="text-right p-2">Diária</th>
                    <th className="text-right p-2 rounded-tr-xl">Semanal</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaNutricional.linhas.map((l, idx) => (
                    <tr key={l.key} className={idx % 2 === 0 ? 'bg-chef-50/50' : 'bg-white'}>
                      <td className="p-2 font-bold text-chef-900">
                        {l.label} <span className="font-normal text-chef-500">({l.unidade})</span>
                      </td>
                      <td className="p-2 text-right">{l.porRefeicao.toFixed(1)}</td>
                      <td className="p-2 text-right font-semibold">{l.diaria.toFixed(1)}</td>
                      <td className="p-2 text-right font-bold text-chef-700">{l.semanal.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Substâncias dos Suplementos */}
        {tabelaNutricional.substanciasSuplementos.length > 0 && (
          <div className="mt-4 pt-3 border-t border-chef-100">
            <h4 className="text-xs font-bold text-chef-800 mb-2">Substâncias dos Suplementos (Rótulo)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-chef-100 text-chef-900">
                    <th className="text-left p-2 rounded-tl-lg">Substância</th>
                    <th className="text-right p-2">Refeição</th>
                    <th className="text-right p-2">Diária</th>
                    <th className="text-right p-2 rounded-tr-lg">Semanal</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaNutricional.substanciasSuplementos.map((s, idx) => (
                    <tr key={idx} className="border-b border-chef-50">
                      <td className="p-2 font-semibold">
                        {s.nome} ({s.unidade})
                      </td>
                      <td className="p-2 text-right">{s.porRefeicao.toFixed(2)}</td>
                      <td className="p-2 text-right">{s.diaria.toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">{s.semanal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardSecao>

      {/* Exportação */}
      <CardSecao titulo="Exportar Cardápio Completo">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!!exportando}
            onClick={() => onExportar('pdf')}
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl bg-tomato/10 text-tomato border border-tomato/30 font-bold text-xs active:scale-95 transition"
          >
            <FileText className="w-5 h-5" />
            {exportando === 'pdf' ? 'Gerando...' : 'Exportar PDF'}
          </button>

          <button
            type="button"
            disabled={!!exportando}
            onClick={() => onExportar('docx')}
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl bg-sky-50 text-sky-700 border border-sky-200 font-bold text-xs active:scale-95 transition"
          >
            <FileType className="w-5 h-5" />
            {exportando === 'docx' ? 'Gerando...' : 'Exportar DOCX'}
          </button>

          <button
            type="button"
            disabled={!!exportando}
            onClick={() => onExportar('xlsx')}
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-2xl bg-emerald-50 text-broccoli border border-emerald-200 font-bold text-xs active:scale-95 transition"
          >
            <FileSpreadsheet className="w-5 h-5" />
            {exportando === 'xlsx' ? 'Gerando...' : 'Exportar XLSX'}
          </button>
        </div>
      </CardSecao>
    </div>
  );
}

/* =========================================================
   COMPONENTES AUXILIARES & MODAIS MANUAIS
========================================================= */
function CardSecao({ titulo, children }) {
  return (
    <div className="bg-white/95 rounded-2xl p-4 shadow-sm border border-chef-100">
      <h3 className="text-sm font-extrabold text-chef-800 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-4 bg-chef-500 rounded-full" />
        {titulo}
      </h3>
      {children}
    </div>
  );
}

function BadgeSaldo({ status, diff }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-broccoli">
        <CheckCircle2 className="w-3 h-3" /> Exato
      </span>
    );
  }
  if (status === 'falta') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-tomato">
        Faltam {diff.toFixed(1)} g
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-carrot">
      Sobram {diff.toFixed(1)} g
    </span>
  );
}

function ModalIngredienteManual({ categoria, onClose, onConfirmar }) {
  const [nome, setNome] = useState('');
  const [quantidadeG, setQuantidadeG] = useState('');
  const [salvarNoBanco, setSalvarNoBanco] = useState(true);
  const labelCat = CATEGORIAS_INGREDIENTES.find((c) => c.id === categoria)?.label || categoria;

  return (
    <div className="fixed inset-0 z-50 bg-chef-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-chef-900">Novo item em {labelCat}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-chef-500" /></button>
        </div>
        <div>
          <label className="label-campo">Nome do Ingrediente *</label>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="input-campo" />
        </div>
        <div>
          <label className="label-campo">Quantidade (g)</label>
          <input type="number" value={quantidadeG} onChange={(e) => setQuantidadeG(e.target.value)} className="input-campo" />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-chef-700">
          <input type="checkbox" checked={salvarNoBanco} onChange={(e) => setSalvarNoBanco(e.target.checked)} className="accent-chef-500" />
          <Database className="w-3.5 h-3.5" /> Salvar também no banco interno
        </label>
        <button
          type="button"
          onClick={() => nome.trim() && onConfirmar({ nome: nome.trim(), quantidadeG, salvarNoBanco })}
          className="w-full py-2.5 bg-chef-500 text-white font-bold rounded-xl"
        >
          Adicionar ao Cardápio
        </button>
      </div>
    </div>
  );
}

function ModalSuplementoManual({ onClose, onConfirmar }) {
  const [sup, setSup] = useState({
    nome: '',
    marca: '',
    lote: '',
    validade: '',
    unidade: 'g',
    quantidadePorRefeicao: 1,
    fotos: [],
    substancias: [{ nome: '', quantidade: '', unidade: 'mg' }]
  });
  const [salvarNoBanco, setSalvarNoBanco] = useState(true);

  const addFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await comprimirImagem(file, 500);
    setSup((p) => ({ ...p, fotos: [...p.fotos, b64] }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-chef-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 space-y-3 max-h-[88vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-chef-900">Suplemento Manual</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-chef-500" /></button>
        </div>
        <input placeholder="Nome do suplemento *" value={sup.nome} onChange={(e) => setSup({ ...sup, nome: e.target.value })} className="input-campo" />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Marca" value={sup.marca} onChange={(e) => setSup({ ...sup, marca: e.target.value })} className="input-campo" />
          <input placeholder="Lote" value={sup.lote} onChange={(e) => setSup({ ...sup, lote: e.target.value })} className="input-campo" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-campo">Validade</label>
            <input type="date" value={sup.validade} onChange={(e) => setSup({ ...sup, validade: e.target.value })} className="input-campo" />
          </div>
          <div>
            <label className="label-campo">Dose / Refeição</label>
            <input type="number" step="0.1" value={sup.quantidadePorRefeicao} onChange={(e) => setSup({ ...sup, quantidadePorRefeicao: e.target.value })} className="input-campo" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold text-chef-700 cursor-pointer">
          <Camera className="w-4 h-4" /> Adicionar foto do suplemento ({sup.fotos.length})
          <input type="file" accept="image/*" className="hidden" onChange={addFoto} />
        </label>

        <label className="flex items-center gap-2 text-xs font-semibold text-chef-700">
          <input type="checkbox" checked={salvarNoBanco} onChange={(e) => setSalvarNoBanco(e.target.checked)} className="accent-chef-500" />
          Salvar suplemento no banco interno
        </label>

        <button
          type="button"
          onClick={() => sup.nome.trim() && onConfirmar(sup, salvarNoBanco)}
          className="w-full py-2.5 bg-chef-500 text-white font-bold rounded-xl"
        >
          Adicionar Suplemento
        </button>
      </div>
    </div>
  );
}
