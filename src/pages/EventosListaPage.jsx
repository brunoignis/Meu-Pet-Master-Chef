import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Search,
  Copy,
  Pencil,
  Trash2,
  Calendar,
  PawPrint,
  Users,
  FileText,
  FileSpreadsheet,
  FileType
} from 'lucide-react';
import { db } from '../db/database';
import {
  calcularResumoAnimais,
  calcularComparativoGrupos,
  analisarSuplementos,
  calcularTabelaNutricional
} from '../utils/calculations';
import { exportarPDF, exportarDOCX, exportarXLSX } from '../utils/exporters';

export default function EventosListaPage({ onNovoEvento, onEditarEvento, onDuplicarEvento }) {
  const [busca, setBusca] = useState('');
  const eventos = useLiveQuery(() => db.eventos.orderBy('criadoEm').reverse().toArray(), []) || [];
  const ingredientesDB = useLiveQuery(() => db.ingredientes.toArray(), []) || [];

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return eventos;
    return eventos.filter(
      (ev) =>
        (ev.titulo || '').toLowerCase().includes(t) ||
        (ev.tutorNome || '').toLowerCase().includes(t) ||
        (ev.animais || []).some((a) => (a.nome || '').toLowerCase().includes(t))
    );
  }, [eventos, busca]);

  const excluirEvento = async (ev) => {
    if (!window.confirm(`Excluir o cardápio "${ev.titulo}" do histórico?`)) return;
    await db.eventos.delete(ev.id);
  };

  const exportarRapido = async (ev, tipo) => {
    const resumoAnimais = calcularResumoAnimais(ev.animais, ev.diasDuracao);
    const comparativo = calcularComparativoGrupos(ev.percentuais, ev.ingredientes, resumoAnimais.totalPeriodoGeralG);
    const analiseSups = analisarSuplementos(ev.suplementos, ev.dataPreparo, ev.diasDuracao, resumoAnimais);
    const tabelaNutricional = calcularTabelaNutricional({
      ingredientes: ev.ingredientes,
      avulsos: ev.avulsos,
      suplementos: ev.suplementos,
      ingredientesDB,
      diasDuracao: ev.diasDuracao,
      resumoAnimais
    });

    const dados = { evento: ev, resumoAnimais, comparativo, analiseSups, tabelaNutricional };
    if (tipo === 'pdf') await exportarPDF(dados);
    if (tipo === 'docx') await exportarDOCX(dados);
    if (tipo === 'xlsx') await exportarXLSX(dados);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-chef-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cardápio, pet ou tutor..."
            className="w-full pl-9 pr-3 py-2.5 bg-white/95 border border-chef-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-chef-400"
          />
        </div>
        <button
          onClick={onNovoEvento}
          className="flex items-center gap-1.5 bg-chef-500 hover:bg-chef-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white/90 border border-dashed border-chef-300 rounded-3xl p-8 text-center space-y-2">
          <p className="text-sm font-bold text-chef-800">Nenhum cardápio arquivado ainda</p>
          <p className="text-xs text-chef-600">
            Toque em <strong>+ Novo</strong> para criar seu primeiro evento nutricional.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((ev) => {
            const resumo = calcularResumoAnimais(ev.animais, ev.diasDuracao);
            const dataBR = ev.dataPreparo ? ev.dataPreparo.split('-').reverse().join('/') : '-';
            return (
              <div
                key={ev.id}
                className="bg-white/95 rounded-2xl p-4 shadow-sm border border-chef-100 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-chef-900 truncate">{ev.titulo}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-chef-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-chef-500" />
                        {dataBR} ({ev.diasDuracao} dias)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-chef-500" />
                        {ev.tutorNome || 'Sem tutor'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-chef-50 text-chef-700 text-xs font-extrabold border border-chef-200 shrink-0">
                    {resumo.totalPeriodoGeralG.toFixed(0)} g
                  </span>
                </div>

                {/* Pets */}
                <div className="flex flex-wrap gap-1.5">
                  {(ev.animais || []).map((a, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-chef-50/80 text-chef-800 text-[11px] font-semibold border border-chef-100"
                    >
                      <PawPrint className="w-3 h-3 text-carrot" />
                      {a.nome || 'Pet'} ({a.refeicoesDia}x {a.pesoRefeicaoG}g)
                    </span>
                  ))}
                </div>

                {/* Ações */}
                <div className="flex items-center justify-between pt-2 border-t border-chef-100 gap-1">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditarEvento(ev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-chef-50 text-chef-700 text-xs font-bold hover:bg-chef-100"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Abrir
                    </button>
                    <button
                      onClick={() => onDuplicarEvento(ev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 text-carrot text-xs font-bold hover:bg-amber-100"
                    >
                      <Copy className="w-3.5 h-3.5" /> Duplicar
                    </button>
                    <button
                      onClick={() => excluirEvento(ev)}
                      className="p-1.5 rounded-lg text-tomato hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => exportarRapido(ev, 'pdf')}
                      className="p-1.5 rounded-lg bg-red-50 text-tomato"
                      title="Exportar PDF"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => exportarRapido(ev, 'docx')}
                      className="p-1.5 rounded-lg bg-sky-50 text-sky-700"
                      title="Exportar DOCX"
                    >
                      <FileType className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => exportarRapido(ev, 'xlsx')}
                      className="p-1.5 rounded-lg bg-emerald-50 text-broccoli"
                      title="Exportar XLSX"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
