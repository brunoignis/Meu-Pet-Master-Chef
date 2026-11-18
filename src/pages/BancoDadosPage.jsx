import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Users,
  PawPrint,
  Beef,
  Pill,
  Plus,
  Search,
  Pencil,
  Trash2,
  Camera,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { db, CATEGORIAS_INGREDIENTES, NUTRIENTES_PADRAO } from '../db/database';
import { comprimirImagem } from '../utils/imageHelper';

const SUBABAS = [
  { id: 'tutores', label: 'Tutores', icon: Users },
  { id: 'animais', label: 'Animais', icon: PawPrint },
  { id: 'ingredientes', label: 'Ingredientes', icon: Beef },
  { id: 'suplementos', label: 'Suplementos', icon: Pill }
];

export default function BancoDadosPage() {
  const [abaAtiva, setAbaAtiva] = useState('tutores');
  const [busca, setBusca] = useState('');
  const [filtroCat, setFiltroCat] = useState('todas');

  const tutores = useLiveQuery(() => db.tutores.orderBy('nome').toArray(), []) || [];
  const animais = useLiveQuery(() => db.animais.orderBy('nome').toArray(), []) || [];
  const ingredientes = useLiveQuery(() => db.ingredientes.orderBy('nome').toArray(), []) || [];
  const suplementos = useLiveQuery(() => db.suplementos.orderBy('nome').toArray(), []) || [];

  const [modalTipo, setModalTipo] = useState(null);
  const [editItem, setEditItem] = useState(null);

  const abrirNovo = () => {
    setEditItem(null);
    setModalTipo(abaAtiva);
  };

  const abrirEditar = (tipo, item) => {
    setEditItem(item);
    setModalTipo(tipo);
  };

  const excluirItem = async (tabela, id, nome) => {
    if (!window.confirm(`Deseja excluir "${nome}" do banco de dados?`)) return;
    await db[tabela].delete(id);
  };

  const termo = busca.trim().toLowerCase();

  const tutoresFiltrados = useMemo(
    () => tutores.filter((t) => t.nome.toLowerCase().includes(termo) || (t.telefone || '').includes(termo)),
    [tutores, termo]
  );

  const animaisFiltrados = useMemo(
    () => animais.filter((a) => a.nome.toLowerCase().includes(termo) || (a.raca || '').toLowerCase().includes(termo)),
    [animais, termo]
  );

  const ingredientesFiltrados = useMemo(
    () =>
      ingredientes.filter((i) => {
        const matchTexto = i.nome.toLowerCase().includes(termo);
        const matchCat = filtroCat === 'todas' || i.categoria === filtroCat;
        return matchTexto && matchCat;
      }),
    [ingredientes, termo, filtroCat]
  );

  const suplementosFiltrados = useMemo(
    () =>
      suplementos.filter(
        (s) => s.nome.toLowerCase().includes(termo) || (s.marca || '').toLowerCase().includes(termo)
      ),
    [suplementos, termo]
  );

  const nomeTutor = (tutorId) => tutores.find((t) => t.id === Number(tutorId))?.nome || 'Sem tutor';

  return (
    <div className="space-y-4">
      {/* Sub-navegação */}
      <div className="grid grid-cols-4 gap-1.5 bg-white/90 backdrop-blur p-1.5 rounded-2xl shadow-sm border border-chef-100">
        {SUBABAS.map((sub) => {
          const Icon = sub.icon;
          const ativo = abaAtiva === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => {
                setAbaAtiva(sub.id);
                setBusca('');
              }}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition ${
                ativo ? 'bg-chef-500 text-white shadow' : 'text-chef-700 hover:bg-chef-50'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="truncate max-w-full">{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* Barra de busca + Botão Novo */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-chef-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${SUBABAS.find((s) => s.id === abaAtiva)?.label.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2.5 bg-white/95 border border-chef-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-chef-400"
          />
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-1.5 bg-chef-500 hover:bg-chef-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          Novo
        </button>
      </div>

      {/* Filtro por categoria apenas para Ingredientes */}
      {abaAtiva === 'ingredientes' && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFiltroCat('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
              filtroCat === 'todas'
                ? 'bg-chef-700 text-white border-chef-700'
                : 'bg-white text-chef-700 border-chef-200'
            }`}
          >
            Todos ({ingredientes.length})
          </button>
          {CATEGORIAS_INGREDIENTES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFiltroCat(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                filtroCat === cat.id
                  ? 'bg-chef-700 text-white border-chef-700'
                  : 'bg-white text-chef-700 border-chef-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* LISTAGEM: TUTORES */}
      {abaAtiva === 'tutores' && (
        <div className="space-y-2.5">
          {tutoresFiltrados.length === 0 && (
            <EmptyCard texto="Nenhum tutor cadastrado. Toque em '+ Novo' para adicionar." />
          )}
          {tutoresFiltrados.map((t) => (
            <div
              key={t.id}
              className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-chef-100 flex items-center gap-3"
            >
              {t.foto ? (
                <img src={t.foto} alt={t.nome} className="w-14 h-14 rounded-full object-cover border-2 border-chef-200" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-chef-100 text-chef-600 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-chef-900 truncate">{t.nome}</h3>
                <p className="text-xs text-chef-600 truncate">{t.telefone || 'Sem telefone'}</p>
                {t.email && <p className="text-xs text-chef-500 truncate">{t.email}</p>}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => abrirEditar('tutores', t)}
                  className="p-2 text-chef-600 hover:bg-chef-50 rounded-lg"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => excluirItem('tutores', t.id, t.nome)}
                  className="p-2 text-tomato hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LISTAGEM: ANIMAIS */}
      {abaAtiva === 'animais' && (
        <div className="space-y-2.5">
          {animaisFiltrados.length === 0 && (
            <EmptyCard texto="Nenhum animal cadastrado. Cadastre os pets e vincule aos tutores." />
          )}
          {animaisFiltrados.map((a) => (
            <div
              key={a.id}
              className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-chef-100 flex items-center gap-3"
            >
              {a.foto ? (
                <img src={a.foto} alt={a.nome} className="w-14 h-14 rounded-2xl object-cover border-2 border-chef-200" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-chef-100 text-chef-600 flex items-center justify-center shrink-0">
                  <PawPrint className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-chef-900 truncate">{a.nome}</h3>
                <p className="text-xs text-chef-700">
                  {a.especie || 'Pet'} • {a.sexo || '-'} • {a.idade || 'Idade n/i'}
                  {a.pesoKg ? ` • ${a.pesoKg} kg` : ''}
                </p>
                <p className="text-xs text-chef-500 truncate">Tutor: {nomeTutor(a.tutorId)}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => abrirEditar('animais', a)}
                  className="p-2 text-chef-600 hover:bg-chef-50 rounded-lg"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => excluirItem('animais', a.id, a.nome)}
                  className="p-2 text-tomato hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LISTAGEM: INGREDIENTES */}
      {abaAtiva === 'ingredientes' && (
        <div className="space-y-2.5">
          {ingredientesFiltrados.length === 0 && <EmptyCard texto="Nenhum ingrediente encontrado." />}
          {ingredientesFiltrados.map((ing) => {
            const cat = CATEGORIAS_INGREDIENTES.find((c) => c.id === ing.categoria);
            return (
              <div
                key={ing.id}
                className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-chef-100 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-chef-900">{ing.nome}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat?.cor || ''}`}>
                      {cat?.label || ing.categoria}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    {ing.dadosCompletos ? (
                      <span className="inline-flex items-center gap-1 text-broccoli font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {ing.nutrientes100g?.kcal || 0} kcal • Prot {ing.nutrientes100g?.proteina || 0}g / 100g
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-carrot font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Tabela nutricional pendente
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => abrirEditar('ingredientes', ing)}
                    className="p-2 text-chef-600 hover:bg-chef-50 rounded-lg"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => excluirItem('ingredientes', ing.id, ing.nome)}
                    className="p-2 text-tomato hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LISTAGEM: SUPLEMENTOS */}
      {abaAtiva === 'suplementos' && (
        <div className="space-y-2.5">
          {suplementosFiltrados.length === 0 && (
            <EmptyCard texto="Nenhum suplemento cadastrado. Adicione marca, lote, validade, fotos e rótulo." />
          )}
          {suplementosFiltrados.map((s) => {
            const vencido = s.validade && new Date(`${s.validade}T00:00:00`) < new Date(new Date().toDateString());
            return (
              <div
                key={s.id}
                className="bg-white/95 rounded-2xl p-3.5 shadow-sm border border-chef-100 flex items-center gap-3"
              >
                {s.fotos?.[0] ? (
                  <img
                    src={s.fotos[0]}
                    alt={s.nome}
                    className="w-14 h-14 rounded-xl object-cover border border-chef-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-chef-100 text-chef-600 flex items-center justify-center shrink-0">
                    <Pill className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-chef-900 truncate">{s.nome}</h3>
                  <p className="text-xs text-chef-700 truncate">
                    Marca: {s.marca || '-'} • Lote: {s.lote || '-'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs">
                    <span className={vencido ? 'text-tomato font-bold' : 'text-chef-600'}>
                      Val: {s.validade ? s.validade.split('-').reverse().join('/') : 'n/i'}
                      {vencido ? ' (Vencido)' : ''}
                    </span>
                    <span className="text-chef-400">•</span>
                    <span className="text-chef-600">{(s.substancias || []).length} substância(s)</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => abrirEditar('suplementos', s)}
                    className="p-2 text-chef-600 hover:bg-chef-50 rounded-lg"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => excluirItem('suplementos', s.id, s.nome)}
                    className="p-2 text-tomato hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAIS DE CADASTRO / EDIÇÃO */}
      {modalTipo === 'tutores' && (
        <ModalTutor item={editItem} onClose={() => setModalTipo(null)} />
      )}
      {modalTipo === 'animais' && (
        <ModalAnimal item={editItem} tutores={tutores} onClose={() => setModalTipo(null)} />
      )}
      {modalTipo === 'ingredientes' && (
        <ModalIngrediente item={editItem} onClose={() => setModalTipo(null)} />
      )}
      {modalTipo === 'suplementos' && (
        <ModalSuplemento item={editItem} onClose={() => setModalTipo(null)} />
      )}
    </div>
  );
}

function EmptyCard({ texto }) {
  return (
    <div className="bg-white/80 border border-dashed border-chef-300 rounded-2xl p-6 text-center text-sm text-chef-600">
      {texto}
    </div>
  );
}

function ModalWrapper({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-chef-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-chef-100">
          <h2 className="font-bold text-lg text-chef-900">{titulo}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-chef-50 text-chef-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- MODAL TUTOR ---------- */
function ModalTutor({ item, onClose }) {
  const [form, setForm] = useState(
    item || { nome: '', telefone: '', email: '', observacoes: '', foto: '' }
  );

  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await comprimirImagem(file, 400);
    setForm((p) => ({ ...p, foto: base64 }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (item?.id) await db.tutores.update(item.id, form);
    else await db.tutores.add(form);
    onClose();
  };

  return (
    <ModalWrapper titulo={item ? 'Editar Tutor' : 'Novo Tutor'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-3">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer group">
            {form.foto ? (
              <img src={form.foto} alt="Foto" className="w-20 h-20 rounded-full object-cover border-2 border-chef-300" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-chef-100 text-chef-600 flex flex-col items-center justify-center border-2 border-dashed border-chef-300">
                <Camera className="w-6 h-6" />
                <span className="text-[10px] font-semibold mt-1">Foto</span>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleFoto} />
          </label>
          <div className="flex-1 space-y-1">
            <p className="text-xs text-chef-600">Toque no círculo para escolher ou tirar foto do tutor.</p>
            {form.foto && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, foto: '' }))}
                className="text-xs text-tomato font-semibold"
              >
                Remover foto
              </button>
            )}
          </div>
        </div>

        <Campo label="Nome completo *" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} required />
        <Campo label="Telefone / WhatsApp" value={form.telefone} onChange={(v) => setForm({ ...form, telefone: v })} />
        <Campo label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <CampoTexto label="Observações" value={form.observacoes} onChange={(v) => setForm({ ...form, observacoes: v })} />

        <button
          type="submit"
          className="w-full py-3 bg-chef-500 hover:bg-chef-600 text-white font-bold rounded-xl shadow"
        >
          Salvar Tutor
        </button>
      </form>
    </ModalWrapper>
  );
}

/* ---------- MODAL ANIMAL ---------- */
function ModalAnimal({ item, tutores, onClose }) {
  const [form, setForm] = useState(
    item || { tutorId: '', nome: '', especie: 'Cão', raca: '', idade: '', sexo: 'Macho', pesoKg: '', foto: '' }
  );

  const handleFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await comprimirImagem(file, 450);
    setForm((p) => ({ ...p, foto: base64 }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const payload = { ...form, tutorId: form.tutorId ? Number(form.tutorId) : '' };
    if (item?.id) await db.animais.update(item.id, payload);
    else await db.animais.add(payload);
    onClose();
  };

  return (
    <ModalWrapper titulo={item ? 'Editar Pet' : 'Novo Pet'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-3">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer">
            {form.foto ? (
              <img src={form.foto} alt="Pet" className="w-20 h-20 rounded-2xl object-cover border-2 border-chef-300" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-chef-100 text-chef-600 flex flex-col items-center justify-center border-2 border-dashed border-chef-300