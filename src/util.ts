import { exec } from '@actions/exec';

export const parseTag = (str: string) => {
  const match1 = str.match(/(\S+)@(\S+)/);
  const packageName = (match1 && match1[1]) as string;
  const version = (match1 && match1[2]) as string;
  const match2 = str.match(/^@(\S+)\/(\S+)@(\S+)/);
  const shortPackageName = (match2 && match2[2]) as string;
  return {
    packageName,
    shortPackageName,
    version,
  }
}

export const getChangelog = (content: string, version: string, prettier: boolean): string[] => {
  const lines = content.split('\n');
  const changeLog = [];
  const changeLogPre = [];
  const startPattern = new RegExp(`^## ${version}`);
  const stopPattern = /^## /; // 前一个版本
  const skipPattern = /^`/; // 日期
  let begin = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (begin && stopPattern.test(line)) {
      break;
    }
    if (begin && line && !skipPattern.test(line)) {
      let l = line;
      if (prettier) {
        if (line.startsWith('-')) l = `${line.replace('-', '◆')}\n`;
        if (line.startsWith('  -')) l = `${line.replace('  -', '\xa0\xa0\xa0\xa0◇')}\n`;
        l = `${l}\n`;
        l = l.replace(/`/g, '');
      }
      changeLogPre.push(l);
      changeLog.push(line);
    }
    if (!begin) {
      begin = startPattern.test(line);
    }
  }
  return [changeLog.join('\n'), changeLogPre.join('\n')];
};

export const filterChangelogs = (changelogArr: string[], filter: string, arr: string[]): string => {
  let result = '';
  changelogArr.forEach((item, index) => {
    if (item === filter) {
      result = arr[index];
    }
  });
  return result;
};

export const replaceMsg = (msg: string, version: string, owner: string, repo: string) => {
  return msg
    .replace('{{v}}', version)
    .replace('{{url}}', `https://github.com/${owner}/${repo}/releases`);
};

export const execOutput = async (command: string) => {
  let myOutput: string = '';
  const options = {
    listeners: {
      stdout: (stdoutData: Buffer) => {
        myOutput += stdoutData.toString();
      },
    },
  };
  await exec(command, [], options);
  return myOutput;
};
