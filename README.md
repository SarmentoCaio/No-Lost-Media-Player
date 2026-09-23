# No Lost Media Player

Aplicação web independente para executar, no navegador, ROMs autorizadas fornecidas pelo usuário. Suporta NES, SNES, Game Boy Advance, Nintendo 64 e PlayStation 1 por meio do EmulatorJS. A integração de PlayStation 2 está arquitetada, mas ainda não ativa.

O projeto não faz scraping, não contém ROMs comerciais e não envia arquivos locais. O catálogo No Lost Media abre os jogos compatíveis diretamente neste player.

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

O servidor do Internet Archive (`archive.org`) responde a requisições de download com redirecionamento `HTTP 302 Found` e nós de CDN que não enviam cabeçalhos `Access-Control-Allow-Origin`, impedindo o `fetch()` direto do navegador devido às restrições de CORS e `Cross-Origin-Embedder-Policy: require-corp`.

Para resolver isso de forma transparente e independente, o **No Lost Media Player** conta com um endpoint de proxy de streaming (`/api/proxy`):
- **Desenvolvimento local:** Integrado diretamente ao Vite (`vite.config.ts`), interceptando requisições para `/api/proxy` e fazendo o repasse com streaming, seguindo redirects e preservando cabeçalhos `Range` (`206 Partial Content`).
- **Produção (Vercel):** Implementado como Vercel Edge Function (`api/proxy.ts`), distribuído globalmente com baixíssima latência e sem limites de timeout do plano Hobby.
- As URLs do `archive.org` são detectadas e roteadas automaticamente pelo proxy (`resolvePlayableRomUrl`), garantindo que tanto ao clicar em "Jogar" no catálogo quanto ao colar uma URL manual na Home, o jogo carregue imediatamente sem erros de CORS.
- Bloqueadores de conteúdo ainda podem interferir com `cdn.emulatorjs.org` caso possuam listas muito restritivas.

## Arquitetura

```text
GamePlayer
├── EmulatorJSPlayer (iframe isolado)
│   ├── NES: fceumm
│   ├── SNES: snes9x
│   ├── GBA: mgba
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
<GamePlayer platform="snes" gameId="id-do-jogo" romUrl="URL_DA_ROM" />
```

O player usa os cores Libretro distribuídos pelo EmulatorJS. NES, SNES, GBA, N64 e PS1 usam o build 4.3.0-pre, necessário para as salas online e que também contém uma versão mais recente do PCSX-ReARMed com correções para jogos japoneses. A versão do CDN é fixada para que uma atualização externa não altere o funcionamento do site sem uma nova publicação.

O PS1 usa `pcsx_rearmed` com a BIOS HLE explicitamente selecionada e não exige que o site distribua o arquivo protegido `scph5500.bin`. No N64, a barra do player permite alternar entre Mupen64Plus e ParaLLEl. O segundo é uma opção de compatibilidade para jogos, GPUs ou drivers que exibem tela preta no Mupen64Plus. Quando WebGL 2 não existe, a troca para ParaLLEl é automática.

## Salvamentos

Os botões **Salvar** e **Carregar** usam uma ponte de mensagens com o iframe do EmulatorJS. Sem configuração, os arquivos `.state` são gravados automaticamente em `No Lost Media Player/Saves` no armazenamento privado do navegador (OPFS), que no Chrome e Edge fica dentro do perfil local do navegador, normalmente sob AppData. Isso não exige uma permissão a cada jogo.

O botão **Pasta de saves** permite substituir o padrão por uma pasta visível escolhida pelo usuário. Essa seleção usa a File System Access API, disponível no Chrome e Edge em HTTPS (e também em `localhost`), e fica registrada no IndexedDB. **Usar padrão** volta ao armazenamento privado. As ROMs continuam sem ser persistidas ou enviadas pelo player.

## Controles e reinicialização

O botão **Controles** abre o mapeamento do EmulatorJS. O host do iframe captura a tecla durante o popup de remapeamento, mesmo quando o navegador move o foco para fora do contêiner do emulador, e o EmulatorJS persiste a escolha para o jogo. O botão **Reiniciar** encerra a instância atual e cria outra com a mesma ROM, mantendo controles e saves.

O emulador pausa automaticamente quando sua aba fica em segundo plano. Ao voltar, fechar ou navegar para fora do player, a página envia um comando explícito de encerramento ao runtime, interrompe o áudio e finaliza o loop de emulação.

## Multiplayer online

Depois que o jogo iniciar, o botão **Jogar online** abre o painel de netplay do EmulatorJS. O primeiro jogador informa seu nome, cria uma sala e pode definir uma senha. O segundo abre exatamente o mesmo jogo, clica em **Jogar online** e entra na sala exibida. São aceitos até quatro jogadores; cada participante controla uma porta local do console emulado.

As salas são separadas por jogo e por domínio. O identificador textual recebido do catálogo é convertido em um número estável, por isso os dois participantes precisam abrir o mesmo item do catálogo (ou selecionar localmente a mesma ROM com o mesmo nome). Durante uma sessão online, a aba do anfitrião continua executando em segundo plano para não interromper a transmissão; ao fechar ou sair da página, a sala e o áudio são encerrados.

O multiplayer exige um servidor de sinalização persistente, pois a hospedagem estática da Vercel não mantém conexões Socket.IO. Este repositório inclui um `render.yaml` e uma imagem em `netplay-server/Dockerfile` que executam o servidor oficial [EmulatorJS-Netplay](https://github.com/EmulatorJS/EmulatorJS-Netplay), fixado em um commit testado. Para criar o serviço padrão no Render:

1. Abra `https://render.com/deploy?repo=https://github.com/SarmentoCaio/No-Lost-Media-Player`.
2. Confirme o serviço `no-lost-media-netplay-sarmentocaio` no plano gratuito.
3. Aguarde o endereço `https://no-lost-media-netplay-sarmentocaio.onrender.com/games` responder com `{}`.

O player usa esse endereço por padrão. Para usar outro servidor, defina `VITE_NETPLAY_SERVER_URL` no ambiente de build da Vercel e publique novamente. A negociação WebRTC usa STUN do Google e TURN público do OpenRelay; em produção com maior tráfego, prefira um TURN próprio ou contratado.

## Plataformas ainda não ativadas

O catálogo também possui Dreamcast, GameCube, Wii, PS2 e PS3. Eles não foram ativados nesta etapa porque não existem cores compatíveis no runtime usado ou exigem runtimes WebAssembly próprios, BIOS, isolamento por cabeçalhos e arquivos de vários gigabytes. `PS2Player` permanece separado para uma futura integração oficial do Play!; Dreamcast e os consoles baseados em Dolphin/RPCS3 também devem receber adaptadores próprios em vez de uma implementação improvisada.

## Integração com No Lost Media

O catálogo monta o contrato de lançamento a partir de um objeto `Game`:

```ts
{
  id: "007-nightfire",
  title: "007 - Nightfire",
  platform: "ps2",
  romUrl: "https://storage.exemplo.com/007-nightfire.chd"
}
```

Como URL, título e plataforma entram por propriedades, nenhuma alteração no componente de emulação será necessária. Autorização, disponibilidade e CORS continuarão sendo responsabilidade da camada de catálogo/armazenamento.
