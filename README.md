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

---

## 📱 Screenshots do Aplicativo

<p align="center">
  <img src="https://github.com/user-attachments/assets/f214fcec-a694-49c7-9819-c8bc1c85cfeb" alt="Tela 1: Fichas de Treino" width="150px" />
  <img src="https://github.com/user-attachments/assets/d19b52a3-29c0-4a63-8945-ec1bd5c2c2da" alt="Tela 2: Exercícios da Ficha" width="150px" />
  <img src="https://github.com/user-attachments/assets/7307d2ea-2c18-4688-b582-3169de4b1ee5" alt="Tela 3: Detalhes do Exercício" width="150px" />
  <img src="https://github.com/user-attachments/assets/142e7827-db96-4663-9610-20fa646ad118" alt="Tela 4: Registro de Carga" width="150px" />
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/c53f45b1-7225-42f4-acbd-a0f7c51e05df" alt="Tela 5: Calendário e Histórico" width="150px" />
  <img src="https://github.com/user-attachments/assets/c8553365-0f9c-4b6d-b575-f2df9e3c51dd" alt="Tela 6: Configurações" width="150px" />
  <img src="https://github.com/user-attachments/assets/86c168fe-f514-4d93-95fc-d591e2c31831" alt="Tela 7: Backup e Restauração" width="150px" />
</p>

---

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

1.  **Clone o repositório:**
    ```bash
    git clone ([https://github.com/mayck-eduardo/EvoFit](https://github.com/mayck-eduardo/EvoFit))
    cd EvoFit
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    # OU
    yarn install
    ```

3.  **Instale as dependências do Expo:**
    ```bash
    npx expo install firebase @react-native-async-storage/async-storage @react-native-picker/picker @expo-google-fonts/inter react-native-gesture-handler @expo/vector-icons react-native-svg react-native-gifted-charts expo-linear-gradient expo-document-picker expo-sharing expo-file-system
    ```

### 3. Configuração do Firebase (Uso de Variáveis de Ambiente)

Este projeto é totalmente dependente do Google Firestore para persistência de dados. Por questões de segurança, as credenciais do Firebase são carregadas através de variáveis de ambiente.

1.  **Configure o Projeto no Console do Firebase:**
    * Crie um Projeto e adicione um aplicativo web.
    * Ative o **Cloud Firestore** em modo de teste (ou configure regras de segurança adequadas).
    * Ative a **Autenticação** por **Email/Senha**.

2.  **Configuração Local do Ambiente (`.env`):**
    * Crie um arquivo na raiz do projeto chamado **`.env`**.
    * Adicione as variáveis de ambiente necessárias (obtidas do console do Firebase) neste arquivo. Lembre-se de adicionar o `.env` ao seu `.gitignore`!

    ```
    # .env
    EXPO_PUBLIC_API_KEY="SUA_API_KEY"
    EXPO_PUBLIC_AUTH_DOMAIN="SEU_AUTH_DOMAIN"
    EXPO_PUBLIC_PROJECT_ID="SEU_PROJECT_ID"
    EXPO_PUBLIC_STORAGE_BUCKET="SEU_STORAGE_BUCKET"
    EXPO_PUBLIC_MESSAGING_SENDER_ID="SEU_MESSAGING_SENDER_ID"
    EXPO_PUBLIC_APP_ID="SEU_APP_ID"
    ```
    > **Nota:** No Expo, as variáveis de ambiente que você deseja acessar no lado do cliente devem ser prefixadas com `EXPO_PUBLIC_`.

3.  **Referência no Código (`firebaseConfig.ts`):**
    * O arquivo `firebaseConfig.ts` deve utilizar `process.env` para carregar as chaves:

    ```typescript
    // firebaseConfig.ts
    const firebaseConfig = {
      apiKey: process.env.EXPO_PUBLIC_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_APP_ID
    };
    ```

### 4. Executando o App

Inicie o servidor de desenvolvimento do Expo:

```bash
npx expo start --clear
