# 🚀 Guia de Publicação — Pagode do Diniz no Cloudflare (Pages + Banco D1 Gratuito)

Este projeto foi totalmente reestruturado para ser hospedado no **Cloudflare Pages** de forma **100% gratuita**, com:
- **Banco de Dados SQL Serverless (Cloudflare D1)**: armazena todas as edições feitas no painel (shows, histórico, fotos, vídeos, configurações).
- **Backend Seguro (Cloudflare Pages Functions)**: a senha administrativa (`diniz2027`) não fica exposta no código do navegador, sendo validada com tokens seguros HMAC pelo servidor.
- **Visualização Pública Inteligente**: visitantes comuns só veem os shows já confirmados (eventos particulares não revelam o local). Administradores logados veem e gerenciam todos os shows (inclusive os em negociação).

---

## 📁 Estrutura do Projeto

```text
Pagode do Diniz Site/
├── public/                 # Arquivos públicos servidos aos visitantes
│   ├── index.html          # Aplicação web completa com layout Dark Stage
│   └── assets/             # Mídias locais (fotos, logotipo, vídeos de shows, música mp3)
├── functions/
│   └── api/
│       └── [[path]].js     # API Serverless conectada ao banco Cloudflare D1
├── schema.sql              # Estrutura da tabela de dados (KV) do D1
├── wrangler.toml           # Arquivo de configuração para o Cloudflare
└── LEIA-ME-PUBLICAR.md     # Este guia passo a passo
```

---

## 🛠️ Método Recomendado: Publicação pelo Painel Web da Cloudflare (Sem precisar de CLI)

Se você utiliza o **GitHub**, essa é a forma mais simples e recomendada:

### Passo 1: Subir o projeto para o seu GitHub
1. Crie um repositório no seu GitHub (público ou privado), por exemplo `pagode-do-diniz`.
2. Envie todos os arquivos desta pasta para lá.

### Passo 2: Criar o Banco de Dados Gratuito (Cloudflare D1)
1. Acesse o painel da Cloudflare: [dash.cloudflare.com](https://dash.cloudflare.com/) e faça login (ou crie sua conta gratuita).
2. No menu lateral esquerdo, clique em **Storage & Databases** > **D1**.
3. Clique no botão **Create database**.
4. Dê o nome de `pagode-do-diniz-db` e clique em **Create**.
5. Na página do banco criado, clique na aba **Console**.
6. Cole o seguinte comando SQL (conteúdo do arquivo `schema.sql`) e clique em **Execute**:
   ```sql
   CREATE TABLE IF NOT EXISTS kv (
     key        TEXT PRIMARY KEY,
     value      TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   ```

### Passo 3: Criar o Projeto no Cloudflare Pages
1. No menu lateral esquerdo da Cloudflare, clique em **Workers & Pages**.
2. Clique no botão **Create application** > selecione a aba **Pages** > **Connect to Git**.
3. Selecione a sua conta do GitHub e escolha o repositório `pagode-do-diniz`.
4. Na tela de configurações da build:
   - **Project name**: `pagode-do-diniz` (ou outro nome de sua preferência)
   - **Production branch**: `main` (ou `master`)
   - **Framework preset**: Selecione `None`
   - **Build command**: Deixe em branco (não precisa de build)
   - **Build output directory**: Preencha com `public`
5. Clique em **Save and Deploy**. O Cloudflare fará o deploy inicial em poucos segundos.

### Passo 4: Conectar o Banco D1 e a Senha de Administrador
Após o primeiro deploy, precisamos conectar o banco de dados e cadastrar a senha:

1. Na página do projeto no Cloudflare Pages, vá na aba **Settings**.
2. Clique em **Functions** no submenu lateral:
   - Role até a seção **D1 database bindings**.
   - Clique em **Add binding**.
   - **Variable name**: Digite exatamente `DB` (em maiúsculas).
   - **D1 database**: Selecione o banco `pagode-do-diniz-db` criado no Passo 2.
   - Clique em **Save**.
3. Agora clique em **Environment variables** no submenu lateral:
   - Clique em **Add variables**.
   - **Variable name**: Digite `ADMIN_PASSWORD`.
   - **Value**: Digite `diniz2027` (ou a senha que desejar para o painel).
   - Marque como secreta (Encrypt) se desejar e clique em **Save**.
4. Vá até a aba **Deployments**, clique nos três pontinhos do último deploy e selecione **Retry deployment** (ou faça um novo commit no GitHub) para que as conexões do banco e senha passem a valer.

Pronto! Seu site estará no ar em um link gratuito como `https://pagode-do-diniz.pages.dev`, funcionando 24h por dia com banco de dados em tempo real!

---

## 💻 Método Alternativo: Publicação via Linha de Comando (Wrangler CLI)

Se você tiver o Node.js instalado e preferir usar o terminal:

1. Faça login na Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Crie o banco de dados D1:
   ```bash
   npx wrangler d1 create pagode-do-diniz-db
   ```
   *O terminal exibirá um `database_id`. Copie esse ID e cole no seu arquivo `wrangler.toml` no campo `database_id`.*

3. Execute a criação da tabela no banco D1:
   ```bash
   npx wrangler d1 execute pagode-do-diniz-db --file=./schema.sql --remote
   ```

4. Cadastre a senha do painel no Cloudflare Pages:
   ```bash
   npx wrangler pages secret put ADMIN_PASSWORD
   # Digite diniz2027 quando solicitado
   ```

5. Publique o projeto:
   ```bash
   npx wrangler pages deploy ./public --project-name=pagode-do-diniz
   ```

---

## 🔒 Como Usar o Painel Administrativo

1. No rodapé do site ou no topo, clique no botão de acesso ou pressione o botão do painel administrativo.
2. Digite a senha: `diniz2027`.
3. Ao entrar:
   - **1. Marca & Logo**: Atualize logotipo, nome da banda, slogan e telefone de WhatsApp.
   - **2. Nossa História**: Edite o texto institucional e foto principal.
   - **3. Integrantes**: Edite os nomes, instrumentos, biografias e @ do Instagram.
   - **4. Galeria de Mídia**: Adicione ou exclua fotos e vídeos de shows.
   - **5. Agenda de Shows**: Cadastre shows informando data, local, horário e se o show é **Público** ou **Particular**.
   - **Aprovação de Datas**: Você pode deixar o show como "Em negociação" (não bloqueia a data) ou clicar em **Aprovar / Fechar** para bloquear a data no calendário público.
4. Qualquer alteração feita é salva automaticamente no banco Cloudflare D1 em tempo real!
