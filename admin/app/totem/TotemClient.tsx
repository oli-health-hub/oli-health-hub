'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Building2, Clock, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

const REFRESH_SECONDS = 300; // 5 min

interface RoomOption {
  id:    string;       // sala-1, copa, reception-001
  label: string;       // "Sala 1", "Copa", "Recepção"
  num:   number;       // 0-9 — usado para gerar código curto único por sala
}

const DEFAULT_ROOMS: RoomOption[] = [
  { id: 'reception-001', label: 'Recepção',     num: 0 },
  { id: 'sala-1',        label: 'Sala 1',       num: 1 },
  { id: 'sala-2',        label: 'Sala 2',       num: 2 },
  { id: 'sala-3',        label: 'Sala 3',       num: 3 },
  { id: 'sala-4',        label: 'Sala 4',       num: 4 },
  { id: 'sala-5',        label: 'Sala 5',       num: 5 },
  { id: 'sala-6',        label: 'Sala 6',       num: 6 },
  { id: 'sala-digital',  label: 'Sala Digital', num: 7 },
  { id: 'copa',          label: 'Copa',         num: 8 },
];

function currentWindow() {
  return Math.floor(Date.now() / 1000 / REFRESH_SECONDS);
}

function buildToken(salaId: string, win: number) {
  return `OLI-CHECKOUT:${salaId}:${win}`;
}

function buildManualCode(salaNum: number, win: number) {
  // 6 dígitos: primeiro dígito = sala (0-8), demais 5 = janela truncada.
  // Determinístico → app valida com mesmo cálculo.
  const winPart = String(win % 100000).padStart(5, '0');
  return `${salaNum}${winPart}`;
}

function fmtCountdown(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function TotemClient() {
  const [room,     setRoom]     = useState<RoomOption>(DEFAULT_ROOMS[0]);
  const [win,      setWin]      = useState(currentWindow());
  const [secsLeft, setSecsLeft] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // Tick every second to update countdown + rotate when window changes
  useEffect(() => {
    const tick = () => {
      const nowWin = currentWindow();
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = REFRESH_SECONDS - (nowSec % REFRESH_SECONDS);
      setWin(nowWin);
      setSecsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const token       = useMemo(() => buildToken(room.id, win),       [room.id, win]);
  const manualCode  = useMemo(() => buildManualCode(room.num, win), [room.num, win]);

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-oli-bg overflow-auto' : ''}>
      <div className="p-7 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-oli-dark">Totem de Checkout</h1>
            <p className="text-sm text-oli-lgray mt-1">
              QR Code + código digitável para checkout dos profissionais. Rotaciona a cada 5 minutos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-oli-border hover:bg-stone-50 transition-colors"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {fullscreen ? 'Sair do modo cheio' : 'Modo cheio'}
          </button>
        </div>

        {/* Room picker */}
        <div className="bg-white rounded-2xl border border-oli-border p-5">
          <p className="text-[11px] font-bold text-oli-lgray uppercase tracking-wider mb-3">Sala</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_ROOMS.map(r => {
              const active = r.id === room.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoom(r)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    active
                      ? 'bg-oli-green text-white border-oli-green'
                      : 'bg-white text-oli-dark border-oli-border hover:bg-stone-50'
                  }`}
                >
                  <Building2 size={13} />
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* QR + Code display */}
        <div className="bg-white rounded-2xl border border-oli-border overflow-hidden">
          <div className="bg-oli-green h-1.5" />
          <div className="p-8 flex flex-col items-center text-center max-w-md mx-auto">

            {/* Logo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://xwcarrurjvfxisuaihid.supabase.co/storage/v1/object/public/assets/logo_oli_transparent.png"
              alt="OLI Health Hub"
              className="h-11 mb-5"
            />

            {/* Room badge */}
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-oli-green text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              <Building2 size={12} />
              {room.label}
            </div>

            {/* QR */}
            <div className="relative inline-block mb-6">
              <div className="absolute inset-[-8px] border-2 border-oli-green/25 rounded-2xl animate-pulse" />
              <div className="relative bg-white p-3 rounded-xl">
                <QRCodeSVG value={token} size={240} level="H" fgColor="#2F2F2F" bgColor="#FFFFFF" />
              </div>
            </div>

            <p className="text-base font-bold text-oli-dark">Aponte a câmera do app</p>
            <p className="text-[13px] text-oli-lgray leading-relaxed mt-1 mb-5">
              Seu checkout será registrado automaticamente após a leitura.
            </p>

            {/* Divisor */}
            <div className="w-full flex items-center gap-2.5 mb-3">
              <span className="flex-1 h-px bg-oli-border" />
              <span className="text-[10px] font-bold text-oli-lgray uppercase tracking-widest">Ou digite o código</span>
              <span className="flex-1 h-px bg-oli-border" />
            </div>

            {/* Código digitável — 6 dígitos */}
            <div className="w-full bg-oli-bg border-2 border-dashed border-oli-green rounded-xl px-5 py-4 mb-3">
              <p className="font-mono text-4xl font-extrabold text-oli-dark tracking-[8px]">
                {manualCode}
              </p>
            </div>
            <p className="text-[11px] text-oli-lgray leading-relaxed mb-5">
              No app, toque em &ldquo;Digitar código&rdquo; e insira os 6 dígitos acima.
            </p>

            {/* Refresh countdown */}
            <div className="flex items-center gap-1.5 text-[11px] text-oli-lgray">
              <Clock size={12} />
              <span>Atualiza em <strong className="text-oli-dark">{fmtCountdown(secsLeft)}</strong></span>
            </div>

          </div>
        </div>

        {/* Info card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <RefreshCw size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[12px] text-blue-900 leading-relaxed">
            <p className="font-bold">Como funciona</p>
            <p className="mt-0.5">
              QR e código rotacionam a cada 5 minutos para prevenir fraude por foto.
              Exiba esta tela em um tablet ou TV fixa em cada sala. Os profissionais escaneiam ou digitam o código no app para encerrar a sessão.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
