interface PS2PlayerProps {
  romUrl: string;
  gameName: string;
}

export function PS2Player({ romUrl, gameName }: PS2PlayerProps) {
  return (
    <div className="ps2-placeholder">
      <span className="ps2-placeholder__chip">PS2</span>
      <h2>Suporte PS2 em desenvolvimento</h2>
      <p>
        O adaptador para Play! WebAssembly será conectado aqui quando os arquivos do runtime estiverem
        disponíveis.
      </p>
      <dl className="ps2-placeholder__details">
        <div><dt>Jogo</dt><dd>{gameName}</dd></div>
        <div><dt>ROM</dt><dd title={romUrl}>{romUrl.startsWith("blob:") ? "Arquivo local selecionado" : "URL configurada"}</dd></div>
      </dl>
    </div>
  );
}
