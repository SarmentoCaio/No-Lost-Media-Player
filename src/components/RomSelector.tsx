import { useRef } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { Platform } from "../types/game";

interface RomSelectorProps {
  platform: Platform;
  url: string;
  selectedFile: File | null;
  error: string | null;
  onUrlChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onStart: () => void;
}

export function RomSelector({
  platform,
  url,
  selectedFile,
  error,
  onUrlChange,
  onFileChange,
  onStart,
}: RomSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const config = emulatorConfig[platform];

  return (
    <section className="rom-panel" aria-labelledby="rom-panel-title">
      <div className="rom-panel__heading">
        <div>
          <p className="eyebrow">{config.name}</p>
          <h2 id="rom-panel-title">Escolha uma ROM</h2>
        </div>
        <span className="format-hint">Formatos: {config.extensionLabel}</span>
      </div>

      <label className="field-label" htmlFor="rom-url">URL da ROM</label>
      <input
        id="rom-url"
        className="text-input"
        type="url"
        value={url}
        placeholder="https://servidor.com/jogos/jogo.zip"
        spellCheck={false}
        disabled={selectedFile !== null}
        onChange={(event) => onUrlChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onStart();
        }}
      />

      <div className="rom-divider"><span>ou</span></div>

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={config.extensions.join(",")}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
      />
      <button className="secondary-button file-button" type="button" onClick={() => inputRef.current?.click()}>
        <span aria-hidden="true">＋</span>
        {selectedFile ? "Trocar arquivo" : "Selecionar arquivo local"}
      </button>
      {selectedFile && (
        <div className="selected-file">
          <span title={selectedFile.name}>{selectedFile.name}</span>
          <button type="button" onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
            onFileChange(null);
          }} aria-label="Remover arquivo">×</button>
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="primary-button" type="button" onClick={onStart}>
        Iniciar jogo
      </button>
      <p className="privacy-note">A ROM local permanece no seu navegador e não é enviada ao servidor.</p>
    </section>
  );
}
