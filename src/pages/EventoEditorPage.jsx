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
  