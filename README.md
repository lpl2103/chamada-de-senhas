# 🔔 ChamaSenha - Sistema de Chamada de Senhas & Gestão de Fila

![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-blue.svg)
![License](https://img.shields.io/badge/licen%C3%A7a-Livre%20para%20uso%20e%20edi%C3%A7%C3%A3o-green.svg)
![Vanilla JS](https://img.shields.io/badge/javascript-ES6%2B-yellow.svg)

O **ChamaSenha** é um sistema completo, moderno e de alta performance para emissão, gerenciamento e chamada de senhas de atendimento em tempo real. Projetado para clínicas, consultórios médicos, cartórios e escritórios de atendimento ao público.

---

## 🌟 Principais Recursos

- 📺 **Painel de Exibição para TV (Sala de Espera)**:
  - Exibição em tela cheia (*Viewport 100vh*) com relógio digital, data, número da senha gigante e destino.
  - **Sinal Sonoro & Anúncio de Voz Inteligente**: Reproduz o gingle sonoro e repete o anúncio por voz 3 vezes (*"Senha normal N 0 0 1 - Consultório 01"*).
  - **Histórico Vertical Compacto**: Lista as 3 últimas senhas chamadas com indicação do local.

- 👨‍⚕️ **Painel de Atendimento do Consultório/Médico**:
  - Seleção da sala/consultório (*Consultório 01 a 05, Guichê 01, 02, Recepção*).
  - Silencioso (sem emissão de áudio no consultório; áudio exclusivo na TV).
  - **Fila em Tempo Real**: Lista todas as senhas cadastradas para a sala, com **prioridades posicionadas sempre no topo**.
  - Permite chamar a próxima senha ou clicar diretamente em qualquer paciente da fila.

- 📍 **Painel de Recepção & Triagem**:
  - Emissão de novas senhas (*Normal `N001`, `N002`...* ou *Prioritária `P001`, `P002`...*) direcionadas a salas específicas ou à Fila Geral.
  - Layout em 2 colunas sem rolagem vertical para fácil operação em notebooks e desktops.
  - Atalhos de teclado para operadores ágeis.
  - Modal customizado para zerar contadores com segurança.

- 💾 **Persistência em Disco & Reset Diário Automático**:
  - Resiliente a quedas de energia: salva o estado em tempo real no arquivo `data/state.json`.
  - **Reset Diário**: Detecta automaticamente a virada do dia (00:00) e zera os contadores para a rotina matinal.

- ⚡ **Arquitetura Híbrida Real-Time (Zero Dependências)**:
  - Funciona via **Node.js Nativo + WebSockets** (Sincronização em rede local/LAN).
  - Funciona também sem Node.js abrindo os arquivos HTML via **BroadcastChannel + LocalStorage**.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (Versão 14 ou superior)

### Passo a Passo

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/SEU_USUARIO/chama-senhas.git
   cd chama-senhas
   ```

2. **Iniciar o Servidor**:
   ```bash
   npm start
   ```

3. **Acessar as Telas no Navegador**:
   - **📍 Recepção & Triagem:** `http://localhost:3000/index.html`
   - **👨‍⚕️ Painel do Consultório:** `http://localhost:3000/atendimento.html`
   - **📺 Painel da TV (Sala de Espera):** `http://localhost:3000/tv.html`

---

## ⌨️ Atalhos de Teclado

### Na Recepção (`index.html`)
- <kbd>→</kbd> (Seta Direita): Chamar Próxima Senha Normal
- <kbd>↑</kbd> (Seta Cima): Chamar Próxima Senha Prioritária
- <kbd>R</kbd>: Repetir Chamada Atual na TV
- <kbd>A</kbd>: Voltar Senha Normal
- <kbd>S</kbd>: Voltar Senha Prioritária
- <kbd>ESC</kbd>: Fechar modal de confirmação

### No Consultório (`atendimento.html`)
- <kbd>→</kbd> ou <kbd>Espaço</kbd>: Chamar Próximo Paciente
- <kbd>R</kbd>: Repetir Chamada na TV

---

## 📄 Licença

Este projeto é de **código aberto** e totalmente **livre para uso, modificação, distribuição e adaptação comercial ou privada**. 

Sinta-se à vontade para utilizar e contribuir com melhorias!

---
Desenvolvido por **Zenit Tecnologia**.
