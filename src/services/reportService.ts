/**
 * reportService.ts
 *
 * Gera e compartilha o extrato mensal do profissional em PDF.
 * Usa expo-print (renderiza HTML → PDF) + expo-sharing.
 *
 * Dados: virão do Supabase (usage_charges, subscriptions, profiles) na Fase 1.
 * Por agora usa os dados passados como parâmetro (mockados na tela Financeiro).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface ReportData {
  period:          string;        // "Maio 2026"
  doctorName:      string;
  crm:             string;
  plan:            string;
  grossRevenue:    number;
  consultations:   number;
  horasUtilizadas: number;
  taxaMin:         number;        // R$ por minuto
  oliCost:         number;        // plano + minutagem
  invoiceHistory: Array<{
    period:  string;
    amount:  number;
    status:  string;
  }>;
  includedServices: Array<{
    name:        string;
    detail:      string;
    marketPrice: number;
    unit:        string;
    used:        boolean;
  }>;
  traditionalOfficeCost: number;
}

// ── Formatação ────────────────────────────────────────────────────────────────

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Template HTML ─────────────────────────────────────────────────────────────

function buildHTML(d: ReportData): string {
  const netRevenue   = d.grossRevenue - d.oliCost;
  const savings      = d.traditionalOfficeCost - d.oliCost;
  const oliPercent   = ((d.oliCost / d.grossRevenue) * 100).toFixed(1);
  const totalMarket  = d.includedServices.reduce((a, s) => a + s.marketPrice, 0);
  const roiMultiple  = (d.grossRevenue / d.oliCost).toFixed(1);
  const generatedAt  = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const invoiceRows = d.invoiceHistory.map(inv => `
    <tr>
      <td>${inv.period}</td>
      <td style="text-align:right">${brl(inv.amount)}</td>
      <td style="text-align:center">
        <span class="badge ${inv.status === 'paga' ? 'badge-green' : inv.status === 'vencida' ? 'badge-red' : 'badge-gold'}">
          ${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
        </span>
      </td>
    </tr>
  `).join('');

  const serviceRows = d.includedServices.map(s => `
    <tr style="opacity: ${s.used ? '1' : '0.5'}">
      <td>${s.name}</td>
      <td style="color:#6B6B6B;font-size:12px">${s.detail}</td>
      <td style="text-align:right;font-weight:600">${brl(s.marketPrice)}/${s.unit}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Extrato OLI Health Hub — ${d.period}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: #F4EFEA;
    color: #2F2F2F;
    padding: 32px;
    font-size: 14px;
  }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid #5F7D67;
  }
  .brand { display: flex; flex-direction: column; gap: 4px; }
  .brand-name { font-size: 24px; font-weight: 800; color: #5F7D67; }
  .brand-sub  { font-size: 12px; color: #6B6B6B; }
  .report-meta { text-align: right; }
  .period { font-size: 20px; font-weight: 700; color: #2F2F2F; }
  .gen-at { font-size: 11px; color: #9E9E9E; margin-top: 4px; }

  /* ── Doctor info ── */
  .doctor-card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
    display: flex;
    gap: 24px;
    border-left: 4px solid #5F7D67;
  }
  .doctor-field { display: flex; flex-direction: column; gap: 2px; }
  .doctor-label { font-size: 11px; color: #9E9E9E; text-transform: uppercase; font-weight: 600; }
  .doctor-value { font-size: 15px; font-weight: 600; color: #2F2F2F; }

  /* ── Cards ── */
  .card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: #2F2F2F;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #E5E5E5;
  }

  /* ── Métricas principais ── */
  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
  .metric { text-align: center; }
  .metric-value { font-size: 26px; font-weight: 800; color: #5F7D67; }
  .metric-label { font-size: 12px; color: #6B6B6B; margin-top: 2px; }

  /* ── ROI ── */
  .roi-line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .roi-line.bold { font-weight: 700; font-size: 16px; border-top: 1px solid #E5E5E5; margin-top: 4px; padding-top: 10px; }
  .roi-line .label { color: #6B6B6B; }
  .roi-line.bold .label { color: #2F2F2F; }

  .savings-box {
    background: #FFF8EE;
    border: 1px solid #B8893C30;
    border-radius: 8px;
    padding: 12px;
    margin-top: 16px;
  }
  .savings-title { font-size: 12px; font-weight: 700; color: #B8893C; margin-bottom: 8px; }
  .savings-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
  .savings-highlight { background: #5F7D6712; border-radius: 8px; padding: 8px 12px; margin-top: 8px; font-size: 14px; font-weight: 600; color: #5F7D67; }

  /* ── Tabelas ── */
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #9E9E9E; font-weight: 600; padding: 0 0 8px 0; border-bottom: 1px solid #E5E5E5; }
  td { padding: 10px 0; border-bottom: 1px solid #F0F0F0; }
  tr:last-child td { border-bottom: none; }

  /* ── Badges ── */
  .badge { display: inline-block; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
  .badge-green { background: #5F7D671A; color: #5F7D67; }
  .badge-gold  { background: #B8893C1A; color: #B8893C; }
  .badge-red   { background: #D9534F1A; color: #D9534F; }

  /* ── Footer ── */
  .footer {
    margin-top: 32px;
    text-align: center;
    font-size: 11px;
    color: #9E9E9E;
    padding-top: 16px;
    border-top: 1px solid #E5E5E5;
  }
  .footer strong { color: #5F7D67; }
</style>
</head>
<body>

<!-- ── Header ── -->
<div class="header">
  <div class="brand">
    <span class="brand-name">OLI Health Hub</span>
    <span class="brand-sub">Plataforma de Operação Assistida Integrada</span>
  </div>
  <div class="report-meta">
    <div class="period">Extrato · ${d.period}</div>
    <div class="gen-at">Gerado em ${generatedAt}</div>
  </div>
</div>

<!-- ── Dados do profissional ── -->
<div class="doctor-card">
  <div class="doctor-field">
    <span class="doctor-label">Profissional</span>
    <span class="doctor-value">${d.doctorName}</span>
  </div>
  <div class="doctor-field">
    <span class="doctor-label">Registro</span>
    <span class="doctor-value">${d.crm || '—'}</span>
  </div>
  <div class="doctor-field">
    <span class="doctor-label">Plano</span>
    <span class="doctor-value">${d.plan}</span>
  </div>
</div>

<!-- ── Métricas do mês ── -->
<div class="card">
  <div class="card-title">Resumo do Mês</div>
  <div class="metrics-grid">
    <div class="metric">
      <div class="metric-value">${brl(d.grossRevenue)}</div>
      <div class="metric-label">Faturamento bruto</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.consultations}</div>
      <div class="metric-label">Consultas realizadas</div>
    </div>
    <div class="metric">
      <div class="metric-value">${d.horasUtilizadas}h</div>
      <div class="metric-label">Horas utilizadas no OLI</div>
    </div>
  </div>

  <!-- ROI -->
  <div class="roi-line">
    <span class="label">Faturamento bruto</span>
    <span style="color:#2F2F2F;font-weight:500">${brl(d.grossRevenue)}</span>
  </div>
  <div class="roi-line">
    <span class="label">Investimento OLI (plano + minutagem)</span>
    <span style="color:#B8893C;font-weight:500">– ${brl(d.oliCost)}</span>
  </div>
  <div class="roi-line bold">
    <span class="label">Receita líquida</span>
    <span style="color:#5F7D67">${brl(netRevenue)}</span>
  </div>

  <div class="savings-box">
    <div class="savings-title">⚖️ Comparativo com Consultório Próprio</div>
    <div class="savings-row">
      <span style="color:#6B6B6B">Custo estimado aluguel + equipe</span>
      <span style="color:#D9534F;font-weight:600">${brl(d.traditionalOfficeCost)}/mês</span>
    </div>
    <div class="savings-row">
      <span style="color:#6B6B6B">Você paga no OLI</span>
      <span style="color:#5F7D67;font-weight:600">${brl(d.oliCost)}/mês</span>
    </div>
    <div class="savings-highlight">
      ✅ Economia de ${brl(savings)} este mês · OLI representa ${oliPercent}% do faturamento · ROI ${roiMultiple}x
    </div>
  </div>
</div>

<!-- ── Serviços inclusos ── -->
<div class="card">
  <div class="card-title">Serviços Inclusos no Plano</div>
  <table>
    <thead>
      <tr>
        <th>Serviço</th>
        <th>Utilização</th>
        <th style="text-align:right">Valor de mercado</th>
      </tr>
    </thead>
    <tbody>
      ${serviceRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="font-weight:700;padding-top:12px">Total de mercado dos serviços</td>
        <td style="text-align:right;font-weight:700;color:#D9534F;padding-top:12px">${brl(totalMarket)}/mês</td>
      </tr>
      <tr>
        <td colspan="2" style="font-weight:700">Você paga (plano OLI)</td>
        <td style="text-align:right;font-weight:700;color:#5F7D67">${brl(d.oliCost)}/mês</td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- ── Histórico de faturas ── -->
<div class="card">
  <div class="card-title">Histórico de Faturas</div>
  <table>
    <thead>
      <tr>
        <th>Período</th>
        <th style="text-align:right">Valor</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${invoiceRows}
    </tbody>
  </table>
</div>

<!-- ── Footer ── -->
<div class="footer">
  <strong>OLI Health Hub</strong> — Av. Paulista, São Paulo – SP<br>
  Este relatório é gerado automaticamente para fins informativos.<br>
  Dados de saúde protegidos conforme <strong>LGPD Lei nº 13.709/2018</strong>.
</div>

</body>
</html>`;
}

// ── Exportação pública ────────────────────────────────────────────────────────

export async function generateAndShareMonthlyReport(data: ReportData): Promise<void> {
  const html = buildHTML(data);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Compartilhamento não disponível neste dispositivo.');

  await Sharing.shareAsync(uri, {
    mimeType:    'application/pdf',
    dialogTitle: `Extrato OLI — ${data.period}`,
    UTI:         'com.adobe.pdf',
  });
}
