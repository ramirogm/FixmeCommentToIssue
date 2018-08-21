# FixmeCommentToIssue

It's a usual practice to add ["Fixme" comments](http://wiki.c2.com/?FixmeComment) to add some notes about the code, as in `XXX This is a really slow impl` or `FIXME This won't work with more than 1 thread accesing this :(` or `TODO clean up code below`.

These comments may get lost or forgotten and "discovered" several months later. To avoid this, you can use this project as a Webhook to create a GitHub issue every time you add one of these comments.

## Implementation

This webtask works as a GitHub WebHook; every time there's a `push` event, it parses each commit and if it finds a {XXX|FIXME|TODO} comment, it creates a GitHub issue.

This webtask parses the commit patches, looking for *new* lines that contain a "task comment" ( XXX, TODO, FIXME). It then creates an issue for each one.


## Install

* Get a GitHub API "Personal Access Token". Go to https://github.com/settings/tokens and create a new one. Be sure to select the "notifications, repo, user" scopes

* Create a new WebTask using the code in this repo and your key. If using the [wt cli](https://webtask.io/docs/wt-cli):
`wt create --name FixmeCommentToIssue --secret GITHUB_API_KEY={personal access token from the previous step} --watch --bundle index.js`

* Create a WebHook on the GitHub repo you want to use. Go to https://github.com/{owner}/{repo}/settings/hooks and create a new one. Use the webtask endpont as the URL, content type should be `application/json`; leave the rest as default.

Now try to add a new comment and push it; in a few seconds your should see the new issue.

Check the webtask log for more details.

## TODO :)

- We could handle the removal of those lines, adding a comment to the corresponding issue.

## License

This is free software.

This project is an simple [webtask](https://webtask.io/) done as an exercise.
