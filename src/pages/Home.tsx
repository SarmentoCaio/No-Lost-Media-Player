import { useState } from "react";
import { emulatorConfig } from "../emulators/emulatorConfig";
import type { Platform, PlayerLaunch } from "../types/game";
import { getFileExtension, isSupportedRom, slugify, titleFromRom, validateRemoteRomUrl } from "../utils/rom";
import { PlatformSelector } from "../components/PlatformSelector";
import { RomSelector } from "../components/RomSelector";

interface HomeProps {
  onStart: (launch: PlayerLaunch) => void;
}

export function Home({ onStart }: HomeProps) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [romUrl, setRomUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectPlatform = (nextPlatform: Platform) => {
    setPlatform(nextPlatform);
    setFile(null);
    setError(null);
  };

  const startGame = () => {
    if (!platform) return;

    if (file) {
      if (!isSupportedRom(file.name, platform)) {
        setError(`Formato não suportado para ${emulatorConfig[platform].name}. Use ${emulatorConfig[platform].extensionLabel}.`);
        return;
      }
      const title = titleFromRom(file.name, emulatorConfig[platform].name);
      onStart({
        gameId: slugify(title),
        title,
        platform,
        romUrl: URL.createObjectURL(file),
        romFile: file,
        source: "local",
      });
      return;
    }

    const validationError = validateRemoteRomUrl(romUrl);
    if (validationError) {
      setError(validationError);
      return;
    }
    const remoteExtension = getFileExtension(romUrl);
    if (platform === "ps2" && remoteExtension && !isSupportedRom(romUrl, platform)) {
      setError(`O Play! precisa da imagem de disco descompactada. O formato ${remoteExtension} não é aceito; use ${emulatorConfig.ps2.extensionLabel}.`);
      return;
    }
    const title = titleFromRom(romUrl, emulatorConfig[platform].name);
    onStart({
      gameId: slugify(title),
      title,
      platform,
      romUrl: romUrl.trim(),
      source: "url",
    });
  };

  return (
    <main className="home-page">
      <header className="hero">
        <span className="brand-mark" aria-hidden="true">NL</span>
        <p className="eyebrow">Jogue no navegador</p>
        <h1>No Lost Media <span>Player</span></h1>
        <p className="hero__description">
          Escolha a plataforma e abra uma ROM autorizada por URL ou diretamente do seu computador.
        </p>
      </header>

      <section className="platform-section" aria-labelledby="platform-title">
        <div className="section-heading">
          <div>
            <p className="step-label">01</p>
            <h2 id="platform-title">Selecione a plataforma</h2>
          </div>
          <p>Emulação local, sem upload de arquivos.</p>
        </div>
        <PlatformSelector selected={platform} onSelect={selectPlatform} />
      </section>

      {platform && (
        <>
          {platform === "ps2" && (
            <p className="platform-beta-notice">
              PS2 está em beta: requer WebGL 2 e um navegador moderno. Imagens de disco grandes são lidas em partes quando o servidor aceita HTTP Range.
            </p>
          )}
          <RomSelector
            platform={platform}
            url={romUrl}
            selectedFile={file}
            error={error}
            onUrlChange={(value) => {
              setRomUrl(value);
              setError(null);
            }}
            onFileChange={(selectedFile) => {
              setFile(selectedFile);
              setError(null);
            }}
            onStart={startGame}
          />
        </>
      )}

      <footer className="site-footer">
        <span>No Lost Media Player</span>
        <span>Use apenas ROMs que você tem permissão para executar.</span>
      </footer>
    </main>
  );
}
