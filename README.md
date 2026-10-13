# LP Cid Pinheiro Farias

Landing page de conversão (botão de WhatsApp) para o tráfego pago do Cid. Hospedada no GitHub Pages, com um robô que mantém a seção "No Instagram" sempre com os 3 posts mais recentes do @psi.cidpinheiro.

## Arquivos

```
index.html                     a página
CNAME                          domínio próprio (cidpinheiropsi.com.br)
favicon.svg                    ícone da aba
assets/                        fotos, imagem de prévia (og-image.jpg) e ícone do iPhone
assets/instagram/              imagens dos posts, gerenciadas pelo robô (não editar à mão)
scripts/instagram.mjs          o robô
scripts/instagram-lib.mjs      filtro de compliance e HTML dos cards
scripts/instagram.config.json  quantidade de posts, termos e posts bloqueados
.github/workflows/instagram.yml  agenda do robô (1x por dia)
```

## 1. Publicar no GitHub Pages

1. Crie um repositório e suba **todos** os arquivos desta pasta, incluindo as pastas `.github` e `scripts`. Pelo site do GitHub, arraste a pasta inteira na tela de upload. Pelo GitHub Desktop também funciona.
2. Em **Settings > Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Domínio `cidpinheiropsi.com.br` (já configurado no `CNAME` e nas tags de prévia do `index.html`). No Registro.br, na zona DNS do domínio:
   - 4 registros **A** no domínio raiz (nome vazio): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - 1 registro **CNAME** com nome `www` apontando para `USUARIO.github.io` (o usuário do GitHub dono do repositório)
   - Em *Settings > Pages > Custom domain*, confirme `cidpinheiropsi.com.br` e, quando liberar, marque *Enforce HTTPS*.
4. Depois de publicar, cole o link no [Depurador de Compartilhamento da Meta](https://developers.facebook.com/tools/debug/) e clique em "Extrair novamente" para atualizar a prévia.

## 2. Conectar o Instagram (uma vez só)

**Pré-requisito:** o @psi.cidpinheiro precisa ser conta profissional (Criador de conteúdo ou Empresa). No Instagram: *Configurações > Tipo de conta e ferramentas*.

Os nomes dos menus da Meta mudam com frequência. Se algo estiver diferente, procure pelos termos entre aspas.

1. Em [developers.facebook.com](https://developers.facebook.com/apps), crie um app. No caso de uso, escolha a opção de **"gerenciar mensagens e conteúdo no Instagram"**.
2. No painel do app, abra **"API do Instagram" > "Configuração da API com login do Instagram"**.
3. Em **"Gerar tokens de acesso"**, clique em adicionar conta e entre com o Instagram do Cid.
   - Se pedir, adicione o Cid em *Funções do app > Testadores do Instagram*. Ele aceita o convite no Instagram, em *Configurações > Apps e sites > Convites de testador*.
   - A permissão necessária é só a `instagram_business_basic` (leitura). Como o app só lê a conta de quem tem função nele, ele pode ficar em modo de desenvolvimento, sem revisão da Meta.
4. Gere o token e copie. Ele é de longa duração (60 dias) e o robô renova sozinho.
5. No repositório: **Settings > Secrets and variables > Actions > New repository secret**
   - Nome `IG_TOKEN`, valor: o token.
6. **Recomendado:** crie um segundo secret `GH_PAT` para o robô conseguir guardar o token quando a Meta devolver um novo na renovação.
   - Em [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), gere um *fine-grained token* com acesso **só a este repositório** e a permissão **Secrets: Read and write**.
   - Sem o `GH_PAT`, o robô avisa no log quando o token mudar, e você precisa atualizar o `IG_TOKEN` à mão antes de 60 dias.
7. Vá em **Actions > "Instagram: últimos posts" > Run workflow** para rodar a primeira vez. O log mostra quais posts entraram e quais foram pulados.

## 3. Como o robô funciona

- Roda todo dia às 06:17 (Brasília). Busca os 25 posts mais recentes, aplica o filtro, pega os 3 primeiros que passam, baixa as imagens para `assets/instagram/` e reescreve o trecho entre `<!-- IG:START` e `<!-- IG:END -->` no `index.html`. Se algo mudou, faz commit e o Pages republica em cerca de 1 minuto.
- Os cards são HTML puro dentro da página. O visitante não espera nada carregar do Instagram.
- **Se der erro** (token vencido, API fora do ar), a página não é tocada e continua com os últimos posts bons. O GitHub manda um e-mail avisando da falha.
- Antes da primeira execução, a página mostra os 3 cards em CSS da série "Uma visão analítico-comportamental".

## 4. Compliance (CFP)

O filtro fica em `scripts/instagram.config.json`:

- `termosBloqueados`: se a **legenda** tiver qualquer um desses termos, o post é pulado. Acentos e maiúsculas não importam, e a busca é por palavra inteira ("cura" bloqueia "a cura", mas não "curadoria").
- `postsBloqueados`: lista de posts que nunca entram. Use o código do link: em `instagram.com/p/ABC123/`, o código é `ABC123`.

**Limite importante:** o robô lê a legenda, não o texto escrito **dentro da imagem**. Se o Cid publicar uma arte com "Agende sua consulta" só na imagem, ela passa. Nesse caso, coloque o código do post em `postsBloqueados` e rode o workflow manualmente. Vale combinar com o Cid de ele avisar quando postar algo de agenda ou divulgação.

## 5. Cuidados

- O GitHub pausa agendamentos depois de 60 dias sem nenhum commit no repositório. Como o robô faz commit a cada post novo, isso só acontece se o Cid ficar 2 meses sem postar. Para reativar: *Actions > "Instagram: últimos posts" > Enable workflow*.
- Para testar o robô no seu computador (precisa do Node 22): `IG_TOKEN=seu_token node scripts/instagram.mjs`.
