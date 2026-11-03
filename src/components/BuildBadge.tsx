import {lifecycleSummary} from '../services/appLifecycleDiagnostics';
import './build-badge.css';

type BuildBadgeProps = {
  compact?: boolean;
};

/**
 * Shows the revision baked into the loaded frontend bundle.
 * It never queries GitHub for the newest commit, which may not be deployed.
 */
export function BuildBadge({ compact = false }: BuildBadgeProps) {
  const { channel, branch, commit } = __SALESSHOP_BUILD__;
  const validCommit = /^[0-9a-f]{40,64}$/i.test(commit) ? commit : '';
  const shortCommit = validCommit ? validCommit.slice(0, 7) : 'unknown';
  const description = `${channel} build · branch ${branch || 'unknown'} · commit ${validCommit || 'unavailable'} · ${lifecycleSummary()}`;
  const contents = <>
    <strong>{channel}</strong>
    <code>{shortCommit}</code>
  </>;
  const className = `sales-build-badge${compact ? ' is-compact' : ''}`;

  return validCommit
    ? <a className={className} data-channel={channel} href={`https://github.com/finnisqu/SalesShop/commit/${validCommit}`}
        target="_blank" rel="noopener noreferrer" title={description} aria-label={description}>
        {contents}
      </a>
    : <span className={className} data-channel={channel} title={description} aria-label={description}>
        {contents}
      </span>;
}
