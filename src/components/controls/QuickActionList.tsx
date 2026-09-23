import { formatKey } from "../../input/consoleMappings";
import { quickActions } from "../../input/quickActions";
import type { QuickActionId, QuickActionSettings } from "../../input/controlTypes";

interface QuickActionListProps {
  settings: QuickActionSettings;
  listeningAction: QuickActionId | null;
  onListen: (action: QuickActionId) => void;
  compact?: boolean;
}

export function QuickActionList({ settings, listeningAction, onListen, compact = false }: QuickActionListProps) {
  return (
    <div className={`quick-action-list${compact ? " quick-action-list--compact" : ""}`}>
      <div className="quick-action-list__heading">
        <div>
          <strong>Ações rápidas</strong>
          <span>Os mesmos atalhos funcionam em todos os consoles</span>
        </div>
        <span className="quick-action-list__scope">GLOBAL</span>
      </div>
      {quickActions.map((action) => (
        <div key={action.id} className={`quick-action-row${listeningAction === action.id ? " is-listening" : ""}`}>
          <span className="quick-action-row__name">
            <i>{action.shortLabel}</i>
            <span><b>{action.label}</b>{!compact && <small>{action.description}</small>}</span>
          </span>
          <button type="button" onClick={() => onListen(action.id)}>
            {listeningAction === action.id ? "Pressione uma tecla…" : formatKey(settings[action.id])}
          </button>
        </div>
      ))}
    </div>
  );
}
