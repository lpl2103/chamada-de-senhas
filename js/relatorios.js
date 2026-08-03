/**
 * ============================================================================
 * SISTEMA CHAMA SENHA - SCRIPT DE RELATÓRIOS BI (VANILLA JAVASCRIPT ES6+)
 * ============================================================================
 * Autor: Zenit Tecnologia (Modernizado por Engenheiro de Software Sênior)
 * Descrição: Script especializado para o Módulo de Relatórios BI (relatorios.html).
 *            Carrega estatísticas TME/TMA do servidor e gera relatórios em CSV.
 * ============================================================================
 */

class ChamaSenhaReports {
  constructor() {
    this.dom = {
      metricTotalIssued: document.getElementById('metricTotalIssued'),
      metricAvgWait: document.getElementById('metricAvgWait'),
      metricAvgService: document.getElementById('metricAvgService'),
      metricTotalAbsent: document.getElementById('metricTotalAbsent'),
      completedCount: document.getElementById('completedCount'),
      reportsTableBody: document.getElementById('reportsTableBody'),
      btnExportCSV: document.getElementById('btnExportCSV'),
      themeToggleBtn: document.getElementById('themeToggleBtn')
    };

    this.metricsData = null;
    this.init();
  }

  init() {
    this.initTheme();
    this.bindEvents();
    this.fetchMetrics();
    setInterval(() => this.fetchMetrics(), 10000);
  }

  bindEvents() {
    this.dom.btnExportCSV?.addEventListener('click', () => this.exportCSV());
    this.dom.themeToggleBtn?.addEventListener('click', () => this.toggleTheme());
  }

  async fetchMetrics() {
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        this.metricsData = await response.json();
        this.renderMetrics(this.metricsData);
      }
    } catch (e) {
      console.warn('[Relatórios Error]: Falha ao buscar métricas:', e);
    }
  }

  renderMetrics(data) {
    if (!data) return;

    if (this.dom.metricTotalIssued) this.dom.metricTotalIssued.textContent = data.totalIssued || 0;
    if (this.dom.metricAvgWait) this.dom.metricAvgWait.textContent = `${data.avgWaitMin || 0} min`;
    if (this.dom.metricAvgService) this.dom.metricAvgService.textContent = `${data.avgServiceMin || 0} min`;
    if (this.dom.metricTotalAbsent) this.dom.metricTotalAbsent.textContent = data.totalAbsent || 0;

    const completed = data.completedTickets || [];
    if (this.dom.completedCount) this.dom.completedCount.textContent = completed.length;

    if (this.dom.reportsTableBody) {
      this.dom.reportsTableBody.innerHTML = '';
      if (completed.length === 0) {
        this.dom.reportsTableBody.innerHTML =
          '<tr><td colspan="7" class="table-empty">Nenhum atendimento concluído hoje.</td></tr>';
      } else {
        completed.forEach(t => {
          const tr = document.createElement('tr');
          const issuedTime = t.createdAt ? new Date(t.createdAt).toLocaleTimeString('pt-BR') : '-';
          const calledTime = t.calledAt ? new Date(t.calledAt).toLocaleTimeString('pt-BR') : '-';
          const statusMap = {
            COMPLETED: '<span class="badge-status success">Concluído</span>',
            ABSENT: '<span class="badge-status danger">Ausente</span>',
            REDIRECTED: '<span class="badge-status info">Reencaminhado</span>'
          };

          tr.innerHTML = `
            <td><strong>${t.id}</strong></td>
            <td>${t.patientName || 'Não Informado'}</td>
            <td>${t.type === 'PRIORIDADE' ? 'Prioritária' : 'Normal'}</td>
            <td>${t.destination || 'Recepção'}</td>
            <td>${issuedTime}</td>
            <td>${calledTime}</td>
            <td>${statusMap[t.status] || t.status}</td>
          `;
          this.dom.reportsTableBody.appendChild(tr);
        });
      }
    }
  }

  exportCSV() {
    if (!this.metricsData || !this.metricsData.completedTickets || this.metricsData.completedTickets.length === 0) {
      alert('Nenhum dado de atendimento disponível para exportar no momento.');
      return;
    }

    const headers = ['Senha', 'Paciente', 'Tipo', 'Local', 'Horario Emissao', 'Horario Chamada', 'Status'];
    const rows = this.metricsData.completedTickets.map(t => [
      t.id,
      `"${t.patientName || 'Não Informado'}"`,
      t.type,
      `"${t.destination || 'Recepção'}"`,
      t.createdAt ? new Date(t.createdAt).toLocaleTimeString('pt-BR') : '',
      t.calledAt ? new Date(t.calledAt).toLocaleTimeString('pt-BR') : '',
      t.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_atendimento_${this.metricsData.dailyDate || 'hoje'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('chama_senha_theme', newTheme);
  }

  initTheme() {
    const savedTheme = localStorage.getItem('chama_senha_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.chamaSenhaReports = new ChamaSenhaReports();
});
