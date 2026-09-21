# No Lost Media Player

Aplicação web independente para executar, no navegador, ROMs autorizadas fornecidas pelo usuário. Esta primeira versão suporta SNES, Nintendo 64 e PlayStation 1 por meio do EmulatorJS. A integração de PlayStation 2 está arquitetada, mas ainda não ativa.

O projeto não faz scraping, não contém ROMs comerciais, não envia arquivos locais e ainda não se conecta ao catálogo do No Lost Media.

## Requisitos e instalação

- Node.js 20 ou superior
- npm 10 ou superior
- conexão com a internet para baixar o runtime do EmulatorJS na primeira execução

```bash
npm install
npm run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`.

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

## Como testar uma ROM local

1. Use apenas uma ROM homebrew, de domínio público ou cujo uso você tenha autorização.
2. Abra `http://localhost:5173`.
3. Selecione a plataforma desejada.
4. Clique em **Selecionar arquivo local** e escolha a ROM.
5. Clique em **Iniciar jogo**.

O navegador cria uma URL temporária com `URL.createObjectURL`. O arquivo não é enviado a servidor algum. Essa URL deixa de funcionar ao atualizar diretamente a página do player; nesse caso, volte e selecione o arquivo novamente.

Para PS1, prefira `.chd` ou `.pbp`. Imagens `.bin/.cue` dependem de mais de um arquivo; em uma seleção local simples, compacte os arquivos relacionados quando a versão/core usada oferecer suporte ou hospede-os mantendo as referências corretas.

## Como testar uma ROM por URL

1. Selecione a plataforma.
2. Cole uma URL HTTPS direta para o arquivo, por exemplo `https://servidor.exemplo/jogo.sfc`.
3. Clique em **Iniciar jogo**.

A URL precisa apontar diretamente para a ROM e o servidor remoto precisa autorizar CORS para a origem da aplicação. Páginas de download, links que exigem cookies e URLs expiradas não funcionam.

## Primeiro teste com SNES

1. Obtenha legalmente uma ROM SNES homebrew/public-domain em `.sfc`, `.smc` ou `.zip`.
2. Rode `npm run dev` e abra `http://localhost:5173`.
3. Clique no card **Super Nintendo**.
4. Para arquivo local, clique em **Selecionar arquivo local**, escolha a ROM e depois clique em **Iniciar jogo**. Para URL, cole o endereço direto no campo e clique em **Iniciar jogo**.
5. Aguarde o runtime do EmulatorJS carregar. Clique dentro do emulador para garantir foco e use o teclado; o menu do próprio EmulatorJS mostra e permite ajustar os controles.
6. Conecte ou pressione um botão no gamepad. O rodapé mudará de “Nenhum controle conectado” para o nome do controle.
7. Clique em **Tela cheia** para testar a Fullscreen API e em **Voltar** para retornar à seleção.

## CORS e erros de carregamento

Antes de inicializar uma ROM remota, o iframe faz uma requisição curta de verificação. Se o servidor não enviar um cabeçalho `Access-Control-Allow-Origin` compatível, a aplicação informa: “O servidor da ROM não permite carregamento por outro domínio.”

O projeto não inclui nem cria um proxy, não tenta contornar CORS e não baixa ROMs para o servidor. Outros erros amigáveis cobrem URL inexistente, falha de conexão, runtime indisponível e formato incompatível. Alguns bloqueadores de conteúdo podem impedir o acesso a `cdn.emulatorjs.org`.

## Arquitetura

```text
GamePlayer
├── EmulatorJSPlayer (iframe isolado)
│   ├── SNES: snes9x
│   ├── N64: mupen64plus_next / parallel_n64
│   └── PS1: pcsx_rearmed
└── PS2Player
    └── Play! WebAssembly (futuro)
```

- `src/components`: seleção, player, barra e adaptadores visuais.
- `src/emulators`: configuração central das plataformas e cores.
- `src/pages`: tela inicial e tela `/play/:platform`.
- `src/storage/saveStorage.ts`: abstração IndexedDB pronta para dados de save, sem armazenar ROMs.
- `public/emulator/emulatorjs/index.html`: host isolado que configura e carrega o EmulatorJS.
- `public/emulator/ps2`: local reservado ao runtime Play! WebAssembly.

O contrato principal não conhece a hospedagem da ROM:

```tsx
<GamePlayer platform="snes" romUrl="URL_DA_ROM" />
```

O player usa os cores Libretro distribuídos pelo EmulatorJS. SNES e N64 permanecem na versão estável 4.2.3; o PS1 usa o build 4.3.0-pre, que contém uma versão mais recente do PCSX-ReARMed com correções para jogos japoneses. As versões do CDN são fixadas para que uma atualização externa não altere o funcionamento do site sem uma nova publicação.

O PS1 usa `pcsx_rearmed` com a BIOS HLE explicitamente selecionada e não exige que o site distribua o arquivo protegido `scph5500.bin`. No N64, a barra do player permite alternar entre Mupen64Plus e ParaLLEl. O segundo é uma opção de compatibilidade para jogos, GPUs ou drivers que exibem tela preta no Mupen64Plus. Quando WebGL 2 não existe, a troca para ParaLLEl é automática.

## Salvamentos

Os botões **Salvar** e **Carregar** usam uma ponte de mensagens com o iframe do EmulatorJS. Clique em **Pasta** para escolher onde os arquivos `.state` serão gravados. A pasta escolhida fica registrada como padrão no IndexedDB e o navegador solicita novamente a permissão quando necessário.

A seleção direta de pasta usa a File System Access API, disponível no Chrome e Edge em HTTPS (e também em `localhost`). As ROMs continuam sem ser persistidas ou enviadas pelo player.

## Plano para PS2

`PS2Player` está separado dos adaptadores EmulatorJS. Quando a distribuição web oficial do Play! for adotada, `Play.js`, `Play.wasm` e o worker poderão ser instalados em `public/emulator/ps2/`, com uma ponte própria de inicialização e erros. Esta versão não improvisa um emulador, não inclui BIOS e mostra “Suporte PS2 em desenvolvimento”.

## Integração futura com No Lost Media

O catálogo poderá montar o mesmo contrato com um objeto `Game`:

```ts
{
  id: "007-nightfire",
  title: "007 - Nightfire",
  platform: "ps2",
  romUrl: "https://storage.exemplo.com/007-nightfire.chd"
}
```

Como URL, título e plataforma entram por propriedades, nenhuma alteração no componente de emulação será necessária. Autorização, disponibilidade e CORS continuarão sendo responsabilidade da camada de catálogo/armazenamento.
