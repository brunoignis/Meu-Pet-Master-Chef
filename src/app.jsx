import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChefHat, Utensils, Database, Settings, Download, Upload, CheckCircle2 } from 'lucide-react';
import { db, inicializarBancoSeVazio } from './db/database';
import EventosListaPage from './pages/EventosListaPage';
import EventoEditorPage from './pages/EventoEditorPage';
import BancoDadosPage from './pages/BancoDadosPage';

export default function App() {
  const [aba, setAba] = useState('eventos'); // 'eventos' | 'banco' | 'config'
  const [editorAberto, setEditorAberto] = useState(false);
  const [eventoEmEdicao, setEventoEmEdicao] = useState(null);

  useEffect(() => {
    inicializarBancoSeVazio();
  }, []);

  const abrirNovoEvento = () => {
    setEventoEmEdicao(null);
    setEditorAberto(true);
  };

  const abrirEditarEvento = (ev) => {
    setEventoEmEdicao(JSON.parse(JSON.stringify(ev)));
    setEditorAberto(true);
  };

  const duplicarEvento = (ev) => {
    const copia = JSON.parse(JSON.stringify(ev));
    delete copia.id;
    delete copia.criadoEm;
    delete copia.atualizadoEm;
    copia.eventoOrigemId = ev.id;
    copia.titulo = `${ev.titulo} (Cópia)`;
    copia.dataPreparo = new Date().toISOString().slice(0, 10);
    setEventoEmEdicao(copia);
    setEditorAberto(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-chef-600 to-chef-500 text-white shadow-md safe-top">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight tracking-tight">Meu Pet Chef</h1>
              <p className="text-[11px] text-chef-100">Cardápio & Preparo Saudável</p>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3.5 pt-4 safe-bottom">
        {editorAberto ? (
          <EventoEditorPage
            eventoInicial={eventoEmEdicao}
            onVoltar={() => setEditorAberto(false)}
            onSalvo={() => {
              setEditorAberto(false);
              setAba('eventos');
            }}
          />
        ) : (
          <>
            {aba === 'eventos' && (
              <EventosListaPage
                onNovoEvento={abrirNovoEvento}
                onEditarEvento={abrirEditarEvento}
                onDuplicarEvento={duplicarEvento}
              />
            )}
            {aba === 'banco' && <BancoDadosPage />}
            {aba === 'config' && <ConfiguracoesPage />}
          </>
        )}
      </main>

      {/* Menu Inferior (esconde quando está dentro do editor para dar mais espaço) */}
      {!editorAberto && (
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-chef-200 shadow-lg">
          <div className="max-w-2xl mx-auto grid grid-cols-3 h-16">
            <NavBtn
              ativo={aba === 'eventos'}
              onClick={() => setAba('eventos')}
              icon={Utensils}
              label="Cardápios"
            />
            <NavBtn
              ativo={aba === 'banco'}
              onClick={() => setAba('banco')}
              icon={Database}
              label="Banco de Dados"
            />
            <NavBtn
              ativo={aba === 'config'}
              onClick={() => setAba('config')}
              icon={Settings}
              label="Ajustes"
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavBtn({ ativo, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition ${
        ativo ? 'text-chef-600' : 'text-chef-400 hover:text-chef-600'
      }`}
    >
      <div className={`px-4 py-1 rounded-full ${ativo ? 'bg-chef-100' : ''}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span>{label}</span>
    </button>
  );
}

/* =========================================================
   TELA DE AJUSTES (RESPONSÁVEL PADRÃO + BACKUP DO BANCO)
========================================================= */
function ConfiguracoesPage() {
  const resp = useLiveQuery(() => db.config.get('responsavelPadrao'), []);
  const [nome, setNome] = useState('');
  const [crmv, setCrmv] = useState('');
  const [salvoOk, setSalvoOk] = useState(false);

  const qtdTutores = useLiveQuery(() => db.tutores.count(), []) || 0;
  const qtdAnimais = useLiveQuery(() => db.animais.count(), []) || 0;
  const qtdIngredientes = useLiveQuery(() => db.ingredientes.count(), []) || 0;
  const qtdSups = useLiveQuery(() => db.suplementos.count(), []) || 0;
  const qtdEventos = useLiveQuery(() => db.eventos.count(), []) || 0;

  useEffect(() => {
    if (resp) {
      setNome(resp.nome || '');
      setCrmv(resp.crmv || '');
    }
  }, [resp]);

  const salvarResp = async (e) => {
    e.preventDefault();
    await db.config.put({ chave: 'responsavelPadrao', nome, crmv });
    setSalvoOk(true);
    setTimeout(() => setSalvoOk(false), 2500);
  };

  const exportarBackupJSON = async () => {
    const backup = {
      versao: 1,
      data: new Date().toISOString(),
      tutores: await db.tutores.toArray(),
      animais: await db.animais.toArray(),
      ingredientes: await db.ingredientes.toArray(),
      suplementos: await db.suplementos.toArray(),
      eventos: await db.eventos.toArray()
    };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meu-pet-chef-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importarBackupJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const dados = JSON.parse(texto);
      if (dados.tutores) await db.tutores.bulkPut(dados.tutores);
      if (dados.animais) await db.animais.bulkPut(dados.animais);
      if (dados.ingredientes) await db.ingredientes.bulkPut(dados.ingredientes);
      if (dados.suplementos) await db.suplementos.bulkPut(dados.suplementos);
      if (dados.eventos) await db.eventos.bulkPut(dados.eventos);
      alert('Backup restaurado com sucesso!');
    } catch {
      alert('Arquivo de backup inválido.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/95 rounded-2xl p-4 shadow-sm border border-chef-100 space-y-3">
        <h2 className="text-sm font-extrabold text-chef-800">Responsável Técnico Padrão</h2>
        <form onSubmit={salvarResp} className="space-y-2.5">
          <div>
            <label className="label-campo">Nome do Profissional</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input-campo" placeholder="Dr(a). Nome" />
          </div>
          <div>
            <label className="label-campo">CRMV / Registro</label>
            <input value={crmv} onChange={(e) => setCrmv(e.target.value)} className="input-campo" placeholder="Ex: CRMV-SP 00000" />
          </div>
          <button className="w-full py-2.5 bg-chef-500 text-white font-bold rounded-xl text-sm shadow">
            Salvar Padrão
          </button>
          {salvoOk && (
            <p className="text-xs text-broccoli font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Dados padrão salvos!
            </p>
          )}
        </form>
      </div>

      <div className="bg-white/95 rounded-2xl p-4 shadow-sm border border-chef-100 space-y-3">
        <h2 className="text-sm font-extrabold text-chef-800">Resumo do Banco Interno</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-chef-50">Tutores: <strong>{qtdTutores}</strong></div>
          <div className="p-2.5 rounded-xl bg-chef-50">Animais: <strong>{qtdAnimais}</strong></div>
          <div className="p-2.5 rounded-xl bg-chef-50">Ingredientes: <strong>{qtdIngredientes}</strong></div>
          <div className="p-2.5 rounded-xl bg-chef-50">Suplementos: <strong>{qtdSups}</strong></div>
          <div className="col-span-2 p-2.5 rounded-xl bg-chef-100 font-bold text-chef-800">
            Cardápios Arquivados: {qtdEventos}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={exportarBackupJSON}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-chef-50 border border-chef-200 text-chef-800 text-xs font-bold"
          >
            <Download className="w-4 h-4" /> Baixar Backup
          </button>
          <label className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-chef-50 border border-chef-200 text-chef-800 text-xs font-bold cursor-pointer">
            <Upload className="w-4 h-4" /> Restaurar
            <input type="file" accept=".json" className="hidden" onChange={importarBackupJSON} />
          </label>
        </div>
      </div>
    </div>
  );
}