import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import { dealStringToArr } from 'actions-util';
import axios from 'axios';
import { parseLernaCommit, parseLernaTag, getChangelog } from './util';

// **********************************************************
async function main(): Promise<void> {
  try {
    // **********************************************************
    const token = core.getInput('token');
    const octokit = new Octokit({ auth: `token ${token}` });

    const dingdingToken = core.getInput('dingding-token');
    const changelogs = core.getInput('changelogs');
    const dingdingChangelogs = core.getInput('dingding-changelogs');
    const branch = core.getInput('branch');
    const prettier = core.getInput('prettier');

    const changelogPathArr = dealStringToArr(changelogs);
    const dingdingChangelogPathArr = dealStringToArr(dingdingChangelogs);

    const { owner, repo } = github.context.repo;
    const { info, error } = core;
    info(`owner: ${owner}, repo: ${repo}`);

    const { head_commit } = github.context.payload;
    const { message } = head_commit;
    if (!message.startsWith('Publish')) {
      error('Invalid commit! Commit format should start `Publish` like lerna.')
      return;
    } else {
      const { tagList } = parseLernaCommit(message);
      const dingdingChangelogArr: { tag: string, dingdingArr: string[] }[] = [];
      tagList.forEach(async tag => {
        const { shortPackageName, version } = parseLernaTag(tag);

        const releaseArr = [];
        const dingdingArr = [];

        const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
        info(`url: ${url}`);

        for (let i = 0; i < changelogPathArr.length; i += 1) {
          const changelogPath = changelogPathArr[i];
          // match changelog path by shortPackageName
          if (changelogPath.includes(shortPackageName)) {
            const { data } = await axios.get(`${url}/${changelogPathArr[i]}`);
            const [changelog, changelogPre] = getChangelog(data, version, prettier !== '');
            releaseArr.push(changelog);
            if (changelog && i !== changelogPathArr.length - 1) {
              releaseArr.push('---');
            }

            // only push changelog for dingding
            if (dingdingChangelogPathArr.includes(changelogPath)) {
              dingdingArr.push(changelogPre);
            }
            if (changelog && i !== changelogPathArr.length - 1) {
              dingdingArr.push('\n\n');
            }
          }
        }
        dingdingChangelogArr.push({
          tag,
          dingdingArr,
        })

        const release = core.getInput('release');
        if (release !== 'false') {
          await octokit.repos.createRelease({
            owner,
            repo,
            tag_name: tag,
            name: tag,
            body: releaseArr.join('\n'),
            draft: false,
            prerelease: false,
            make_latest: 'true',
          });
          info(`[Actions] Success release ${tag}.`);
        } else {
          info(`[Actions] Skip release ${tag}.`);
        }
      });

      if (dingdingToken) {
        let log = dingdingChangelogArr.map(item => {
          return `## ${item.tag}\n${item.dingdingArr.join('')}`
        }).join('---');
        let msgTitle = core.getInput('msg-title');
        const msgPoster = core.getInput('msg-poster');
        let msgFooter = core.getInput('msg-footer');

        if (msgPoster) {
          log = `![](${msgPoster})\n\n${log}`;
        }
        if (msgTitle) {
          log = `${msgTitle}\n\n${log}`
        }
        if (msgFooter) {
          msgFooter = msgFooter.replace('{{url}}', `https://github.com/${owner}/${repo}/releases`)
          log += `\n\n${msgFooter}`;
        }

        const time = core.getInput('dingding-delay-minute') || 0;
        info(`[Actions] [time] ${time} start: ${Date.now().toLocaleString()}`);

        setTimeout(async () => {
          info(`[Actions] [time] ${time} go: ${Date.now().toLocaleString()}`);
          const dingdingTokenArr = dingdingToken.split(' ');
          /* eslint-disable no-await-in-loop, no-restricted-syntax */
          for (const dingdingTokenKey of dingdingTokenArr) {
            if (dingdingTokenKey) {
              await axios.post(
                `https://oapi.dingtalk.com/robot/send?access_token=${dingdingTokenKey}`,
                {
                  msgtype: 'markdown',
                  markdown: {
                    title: msgTitle,
                    text: log,
                  },
                },
              );
            }
          }

          const formatTagString = tagList.map((tag, index) => {
            if (index === tagList.length - 1) {
              return `- ${tag}`;
            }
            return `- ${tag}\n`;
          }).join('')

          info('[Actions] Success post dingding message for:');
          info(formatTagString);
        }, +time * 1000 * 60);
      }
    }

  } catch (e: any) {
    core.error(`[Actions] Error: ${e.message}`);
  }
}

main();
