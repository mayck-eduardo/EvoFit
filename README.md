# 🏋️ EvoFit - Gerenciador de Treinos e Progressão de Carga

[![React Native](https://img.shields.io/badge/React%20Native-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-1B1F22?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

## 🌟 Sobre o Projeto

O **EvoFit** é um aplicativo móvel cross-platform desenvolvido em **React Native** (utilizando **Expo** e **Expo Router**) que tem como objetivo ser um assistente pessoal para o gerenciamento de treinos de força. Ele permite que os usuários criem e gerenciem suas fichas de treino, registrem a progressão de carga (peso e repetições) diariamente e visualizem seu histórico de evolução de forma clara através de gráficos de linha.

## ✨ Funcionalidades Principais

* **🔑 Autenticação Segura:** Login e Cadastro com Email e Senha (Firebase Auth).
* **📋 Gerenciamento de Fichas:** Sistema CRUD completo para criar, ler e organizar suas rotinas de treino.
* **📝 Registro Detalhado:** Marque exercícios concluídos no dia e registre o peso/repetições em um modal dedicado.
* **📈 Visualização de Progresso:** Gráficos de linha interativos que mostram a evolução da carga ao longo do tempo por exercício.
* **💾 Backup & Restauração:** Funcionalidades de Exportação e Importação de todo o banco de dados do treino via arquivo JSON.
* **🗓️ Treino do Dia:** Aba dedicada para focar na rotina selecionada e acompanhar o progresso atual.

## 🛠️ Tecnologias Utilizadas

| Categoria | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Framework** | **React Native** | Para o desenvolvimento da interface mobile. |
| **Ambiente** | **Expo** (com **Expo Router**) | Simplifica o desenvolvimento e gerencia a navegação baseada em arquivos. |
| **Banco de Dados** | **Google Firestore** | Utilizado como o banco de dados em tempo real para armazenar dados de rotinas e logs. |
| **Autenticação** | **Firebase Auth** | Gerencia o sistema de login e cadastro (Email/Senha). |
| **Gráficos** | `react-native-gifted-charts` | Componentes prontos para exibir a progressão de carga. |
| **Fontes** | `@expo-google-fonts/inter` | Utilização de fontes modernas para um design limpo. |

## 🚀 Como Rodar o Projeto

### 1. Pré-requisitos

* [Node.js](https://nodejs.org/) e npm (ou yarn) instalados.
* [Expo CLI](https://docs.expo.dev/workflow/expo-cli/) instalado globalmente (opcional: `npm install -g expo-cli`).
* Conta e projeto configurado no [Google Firebase](https://firebase.google.com/).

### 2. Configuração Local

1.  **Clone o repositório:**
    ```bash
    git clone [URL_DO_SEU_REPOSITORIO]
    cd EvoFit
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # OU
    yarn install
    ```

3.  **Instale as dependências do Expo:**
    ```bash
    npx expo install firebase @react-native-async-storage/async-storage @react-native-picker/picker @expo-google-fonts/inter react-native-gesture-handler @expo/vector-icons react-native-svg react-native-gifted-charts expo-linear-gradient expo-document-picker expo-sharing expo-file-system
    ```

### 3. Configuração do Firebase

Este projeto é totalmente dependente do Google Firestore para persistência de dados.

1.  **Configure o Projeto no Console do Firebase:**
    * Crie um Projeto e adicione um aplicativo web.
    * Ative o **Cloud Firestore** em modo de teste (ou configure regras de segurança adequadas).
    * Ative a **Autenticação** por **Email/Senha**.
    * Obtenha o objeto de configuração (`firebaseConfig`).

2.  **Atualize o Arquivo de Configuração:**
    * Abra o arquivo `firebaseConfig.ts` na raiz do projeto.
    * Substitua o objeto de configuração com as suas credenciais reais do Firebase:
    
    ```typescript
    // firebaseConfig.ts
    const firebaseConfig = {
      apiKey: "SUA_API_KEY",
      authDomain: "SEU_AUTH_DOMAIN",
      projectId: "SEU_PROJECT_ID",
      storageBucket: "SEU_STORAGE_BUCKET",
      messagingSenderId: "SEU_MESSAGING_SENDER_ID",
      appId: "SEU_APP_ID"
    };
    ```

### 4. Executando o App

Inicie o servidor de desenvolvimento do Expo:

```bash
npx expo start --clear
```
## 🤝 Contribuições
Contribuições, issues e sugestões são bem-vindas! Sinta-se à vontade para abrir uma issue ou enviar um Pull Request para ajudar a melhorar o EvoFit.

## 👨‍💻 Desenvolvedor
Desenvolvido por Mayck Eduardo (Estudante de Engenharia da Computação).

GitHub: https://github.com/mayck-eduardo
