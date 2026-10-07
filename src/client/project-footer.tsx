/**
 * [INPUT]: 依赖 Host Tooltip、LinkIconRegular 和组合根绑定的 locale 文案。
 * [OUTPUT]: 提供 ProjectFooter，Star 提示与项目图标成组，固定作者名独占末端；不请求网络或写入设置。
 * [POS]: Plugins 设置详情的末尾展示层；组合根拥有语言订阅，styles 将整排紧凑靠右并复用设置正文字号与原生几何。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React from 'react';
import { Tooltip, LinkIconRegular } from '@deepseek-ai/dsh-client-ui-primitives';

const PROJECT_URL = 'https://github.com/daftAI2026/PDSH';
const AUTHOR_URL = 'https://x.com/singkid9527';
const AUTHOR_LABEL = '@daftAI';

export function ProjectFooter({ t }) {
  return <footer className="pdsh-project-footer">
    <div className="pdsh-project-support">
      <p>{t('project.star')}</p>
      <Tooltip label={t('project.github')} side="bottom" delayMs={500} focusDelayMs={0} portal>
        <a className="pdsh-project-link pdsh-project-github" href={PROJECT_URL} target="_blank" rel="noopener noreferrer" aria-label={t('project.github')}>
          <span aria-hidden="true"><LinkIconRegular kind="url" href={PROJECT_URL} /></span>
        </a>
      </Tooltip>
    </div>
    <Tooltip label={t('project.author')} side="bottom" delayMs={500} focusDelayMs={0} portal>
      <a className="pdsh-project-link pdsh-project-author" href={AUTHOR_URL} target="_blank" rel="noopener noreferrer" aria-label={t('project.author')}>
        {AUTHOR_LABEL}
      </a>
    </Tooltip>
  </footer>;
}
