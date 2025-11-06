🏋️ EvoFit - Gerenciador de Treinos e Progressão de Carga

O EvoFit é um aplicativo móvel desenvolvido em React Native (usando Expo e Expo Router) que permite aos usuários gerenciar suas fichas de treino, registrar a progressão de carga (peso e repetições) diariamente e visualizar o histórico de evolução em gráficos.

✨ Funcionalidades

Autenticação: Login e Cadastro com Email e Senha (Firebase Auth).

Gerenciamento de Fichas: CRUD (Criar, Ler, Deletar) de fichas de treino.

Registro de Exercícios: CRUD de exercícios dentro de cada ficha.

Marcação Diária: Botão de "Check" para marcar exercícios concluídos no dia.

Progressão: Registro de Peso e Repetições em um modal dedicado.

Visualização de Dados: Gráficos de linha que mostram a evolução da carga ao longo do tempo.

Backup: Exportação e Importação de todo o banco de dados do treino via arquivo JSON.

Treino do Dia: Aba dedicada para selecionar uma ficha e ver o progresso atual.

🛠️ Tecnologias Utilizadas

Framework: React Native

Ambiente: Expo (com Expo Router para navegação baseada em arquivos)

Banco de Dados: Google Firestore (Realtime Database)

Autenticação: Firebase Authentication (Email/Senha)

Gráficos: react-native-gifted-charts e react-native-svg

Fontes: @expo-google-fonts/inter

🚀 Como Rodar o Projeto

1. Pré-requisitos

Node.js e npm (ou yarn) instalados.

Expo CLI instalado globalmente (opcional, mas recomendado).

Conta no Firebase.

2. Configuração Local

Clone o repositório:

git clone [URL_DO_SEU_REPOSITORIO]
cd EvoFit


Instale as dependências:

npm install
# OU
yarn install


Instale as dependências do Expo que podem ter sido omitidas:

npx expo install firebase @react-native-async-storage/async-storage @react-native-picker/picker @expo-google-fonts/inter react-native-gesture-handler @expo/vector-icons react-native-svg react-native-gifted-charts expo-linear-gradient expo-document-picker expo-sharing expo-file-system


3. Configuração do Firebase e Firestore

Este projeto depende do Google Firestore. É obrigatório configurar os seguintes passos:

Crie um Projeto Firebase (Ex: evofit-app-d2e47).

Ative a Autenticação por Email/Senha:

No console do Firebase, vá em Authentication -> Sign-in method -> Ative Email/Senha.

Ative a API do Firestore:

No console do Firebase, vá em Cloud Firestore -> Criar Banco de Dados (escolha Modo de Teste).

Se a API do Firestore não estiver ativa, clique no link de ativação no Google Cloud Console.

Obtenha as Credenciais Web:

Em Configurações do Projeto (⚙️) -> Seus apps -> Clique no ícone de App da Web (</>).

Copie o objeto firebaseConfig.

4. Configuração do Arquivo firebaseConfig.ts

Abra o arquivo firebaseConfig.ts na raiz do projeto e substitua o objeto firebaseConfig com as suas credenciais reais.

// Exemplo (Use suas credenciais reais):
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  // ...
};


5. Executando o App

Inicie o servidor Expo (use --clear para garantir que o cache do Metro seja limpo após a instalação):

npx expo start --clear


Use o aplicativo Expo Go no seu dispositivo móvel para escanear o QR code.

💾 Estrutura do Banco de Dados (Firestore)

A estrutura do Firestore segue o modelo de escopo por usuário e por aplicação:

/artifacts
  /default-app-id 
    /users
      /{userId} (UID da conta logada)
        /routines (Coleção de Fichas: Ex: Segunda, Terça)
          /{routineId}
            /exercises (Coleção de Exercícios)
              /{exerciseId}
                /logs (Coleção de Registros de Carga/Progresso)
                  /{logId} (Documento: {weight: 80, reps: 10, createdAt: timestamp})


👨‍💻 Contato

Desenvolvido por [Seu Nome/GitHub User] (Estudante de Engenharia da Computação).

Fique à vontade para contribuir e melhorar!
