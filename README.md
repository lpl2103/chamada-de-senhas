# 🔔 ChamaSenha Enterprise - Sistema de Chamada de Senhas & Gestão de Fila

![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-blue.svg)
![License](https://img.shields.io/badge/licen%C3%A7a-Livre%20para%20uso%20e%20edi%C3%A7%C3%A3o-green.svg)
![Vanilla JS](https://img.shields.io/badge/javascript-ES6%2B-yellow.svg)

O **ChamaSenha Enterprise** é um sistema completo, moderno e de alta performance para emissão, gerenciamento e chamada de senhas de atendimento em tempo real. Projetado para clínicas, consultórios médicos, cartórios e escritórios de atendimento ao público.

---

## 🌟 Principais Recursos

- 📺 **Painel de Exibição para TV (2 Opções)**:
  - **`tv.html` (TV Básica)**: Exibição limpa em tela cheia com relógio, número da senha gigante, destino e histórico vertical de 3 chamadas.
  - **`tvads.html` (TV Mídia Indoor)**: Layout em duas zonas (*55% Chamada de Senhas + 45% Player de Vídeos Institucionais / Mídia Indoor + Ticker de Notícias*).

- 📱 **Acompanhamento do Paciente pelo Celular (`paciente.html`)**:
  - O paciente escaneia o QR Code impresso no ticket e acompanha pelo celular quantas pessoas estão na frente dele em tempo real (*"Você é o próximo! Faltam 2 pessoas"*).

- 🖨️ **Emissão & Impressão Térmica de Ticket Físico**:
  - Emissão com ou sem o **Nome do Paciente**.
  - Impressão formatada para bobinas térmicas de 80mm/58mm com logo, data/hora, senha gigante e QR Code para celular.

- 👨‍⚕️ **Painel do Consultório / Atendimento**:
  - Seleção da sala (*Consultório 01 a 05, Guichê 01, 02, Recepção*).
  - Botões operacionais de estado: **`INICIAR`** (inicia a consulta e desabilita o botão), **`FINALIZAR`**, **`AUSENTE`** e **`REENCAMINHAR`** (envia o paciente para outra sala/exame).

- 📊 **Dashboard de Relatórios & BI (`relatorios.html`)**:
  - Cálculo automático de **Tempo Médio de Espera (TME)** e **Tempo Médio de Atendimento (TMA)**.
  - Exportação de planilhas de relatórios diários em **CSV/Excel**.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (Versão 14 ou superior)

### Passo a Passo

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/lpl2103/chamada-de-senhas.git
   cd chamada-de-senhas
   ```

2. **Iniciar o Servidor**:
   ```bash
   npm start
   ```

3. **Acessar as Telas no Navegador**:
   - **📍 Recepção & Triagem:** `http://localhost:3000/index.html`
   - **👨‍⚕️ Painel do Consultório:** `http://localhost:3000/atendimento.html`
   - **📺 Painel da TV Básica:** `http://localhost:3000/tv.html`
   - **🎬 Painel TV Mídia Indoor:** `http://localhost:3000/tvads.html`
   - **📱 Tela do Paciente (Celular):** `http://localhost:3000/paciente.html?ticket=N001`
   - **📊 Relatórios & BI:** `http://localhost:3000/relatorios.html`

---

## 📄 Licença

Este projeto é de **código aberto** e totalmente **livre para uso, modificação, distribuição e adaptação comercial ou privada**. 

---
Desenvolvido por **Zenit Tecnologia**.
