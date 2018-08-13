const fetch = require('node-fetch');

/**
 * FixmeCommentToIssue
 * 
 * Works as a github repo Webhook, listening for "push" events.
 * If it finds a change which adds a line having a "TASK" comment ( as in "XXX fix this hack" - TODO and FIXME work too),
 * it creates an issue with the related data ( file, committer, date )
 * 
 * You need to set the GITHUB_API_KEY secret
 * 
 * In the future we could also handle "TASK" lines removal ( when a "TASK" lines is removed, we could update the corresponding issue stating this)
 */

const MAX_ISSUE_TITLE_SIZE = 50;
const TASK_LABEL = "FIXME";

let fetchOptions = null;
/** 
* @param context {WebtaskContext}
* @param cb {callback(error,result)}
*/
module.exports = function(context, cb) {
  console.log("Received:", context.body);
  const pushEvent = context.body;
  if ( !pushEvent ) {
    const error = { error: "empty push event"};
    cb(error, null);
    return;
  }

  if ( !context.secrets.GITHUB_API_KEY ) {
    const error = { error: "You must define the GITHUB_API_KEY secret"};
    cb(error, null);
    return;
  }

  fetchOptions = DEFAULT_FETCH_OPTIONS(context.secrets.GITHUB_API_KEY);

  try {
    handlePushEvent(pushEvent)
    .then( result => cb(null, result));
  } catch (error) {
    cb(error, null);
  }
};

const DEFAULT_FETCH_OPTIONS = (githubApiKey) => { return {
  method: 'GET',
  headers: {
    "User-Agent": "FIXME helper",
    "Accept": "application/vnd.github.v3+json",
    "Authorization": "token " + githubApiKey,
  }
}};

/**
 * Processes all commits in the push event, fetching them from the repo
 * 
 * @param {Object} pushEvent 
 */
const handlePushEvent = (pushEvent) => {
  const commitsUrl = getCommitsUrl(pushEvent);
  const repoIssuesUrl = getIssuesUrl(pushEvent);
  const pushEventCommits = pushEvent.commits;
  if ( !pushEventCommits ) return {};
  // TODO This will fail as soon as any commit rejects.
  return Promise.all(pushEventCommits.map( pushEventCommit => {
    const commitUrl = getCommitUrl(commitsUrl, pushEventCommit);
    return fetch(commitUrl, fetchOptions)
    .then(res => res.json())
    .then(json => processCommit(json, repoIssuesUrl));
  }));
}

/**
 * Processes all files in the commit, looking for "task" comments
 * Creates a GitHub issue for each new comment
 * 
 * @param {Object} commit 
 * @param {Object} repoIssuesUrl 
 */
const processCommit = (commit, repoIssuesUrl) => {
  console.log("Processing commit: ", commit);
  const files = commit.files;
  const issues = [];
  files.forEach( f => {
    const taskLines = getTaskLines(f);
    taskLines.forEach(line  => {
      issues.push(createIssueBody(line, f, commit ));
    });
  });
  console.log("Issues: ", issues);
  return createGitHubIssues(issues, repoIssuesUrl);
}

/**
 * Creates a GitHub issue body.
 * 
 * @see https://developer.github.com/v3/issues/#create-an-issue
 * @param {String} line The line containing the task comment
 * @param {String} f GitHub commit file 
 * @param {Object} commit GitHub commit
 */
const createIssueBody = ( line, f, commit) => {
  const authorName = commit.commit.author.name;
  const commitDate = commit.commit.author.date;

  let trimmedLine = line;
  if ( trimmedLine.indexOf("+") == 0 ) { trimmedLine = trimmedLine.slice(1)};
  trimmedLine = trimmedLine.trim();
  if ( trimmedLine.indexOf("//") == 0 ) { trimmedLine = trimmedLine.slice(2)};
  trimmedLine = trimmedLine.trim();
  trimmedLine = trimmedLine.slice(0,MAX_ISSUE_TITLE_SIZE);
  const newIssue = {
    title: `${trimmedLine}`,
    body: `File: [${f.filename}](${f.blob_url})\nCommit: ${commit.sha}\nAuthor name: ${authorName} on ${commitDate}`,
    labels: [
      TASK_LABEL
    ]
  };
  return newIssue;  
}

/**
 * Creates a new issue on GitHub for each one of the issues
 * 
 * @param {Array[GitHubIssue]} issues 
 * @param {String} repoIssuesUrl GitHub repo issues url
 */
function createGitHubIssues(issues, repoIssuesUrl) {
  // TODO This fails as soon as any one fails
  return Promise.all(issues.map(issueBody => {
    const options = {
      ...fetchOptions,
      method: 'POST',
      body: JSON.stringify(issueBody),
    };
    return fetch(repoIssuesUrl, options)
      .then(res => res.json());
  }));
}

/**
 * Parses the file patch and returns the new lines that reference a "TASK" comment
 * 
 * @see https://developer.github.com/v3/repos/commits/#get-a-single-commit
 * 
 * @param {Object} f a GitHub commit's file entry 
 */
function getTaskLines(f) {
  const patch = f.patch;
  const lines = patch.split("\n");
  const addedLines = lines.filter(l => l && l[0] === "+" && l.length > 1);
  const taskLines = addedLines.filter(l => l.indexOf("XXX") > 0 || l.indexOf("FIXME") > 0 || l.indexOf("TODO") > 0); //TODO extract as constant and reduce
  return taskLines;
}

function getCommitUrl(commitsUrl, pushEventCommit) {
  return commitsUrl.replace("{/sha}", "/" + pushEventCommit.id);
}

/**
 * Extracts the repo commits URL from the Push Event
 * 
 * @see https://developer.github.com/v3/activity/events/types/#webhook-event-name-33
 * @param {Object} pushEvent 
 */
function getCommitsUrl(pushEvent) {
  const commitsUrl = pushEvent.repository.commits_url;
  if (commitsUrl.indexOf("{/sha}") === -1)
    throw new Error("Invalid repository commits_url");
  return commitsUrl;
}

/**
 * Extracts the repo issues URL from the Push Event
 * 
 * @see https://developer.github.com/v3/activity/events/types/#webhook-event-name-33
 * @param {Object} pushEvent 
 */
function getIssuesUrl(pushEvent) {
  const issuesUrl = pushEvent.repository.issues_url;
  if (issuesUrl.indexOf("{/number}") === -1)
    throw new Error("Invalid repository issues_url");
  const repoIssuesUrl = issuesUrl.replace("{/number}", "");
  return repoIssuesUrl;
}

