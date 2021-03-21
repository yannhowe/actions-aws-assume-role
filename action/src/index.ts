import * as core from '@actions/core';
import * as http from '@actions/http-client';

interface AssumeRoleParams {
  githubToken: string;
  awsRegion: string;
  roleToAssume: string;
  roleDurationSeconds: number;
  roleSessionName: string;
  roleSessionTagging: boolean;
  providerEndpoint: string;
}

interface AssumeRolePayload {
  github_token: string;
  role_to_assume: string;
  role_session_name: string;
  duration_seconds: number;
  repository: string;
  sha: string;
  role_session_tagging: boolean;
  action: string;
  workflow: string;
  actor: string;
  branch: string;
}

interface AssumeRoleResult {
  access_key_id: string;
  secret_access_key: string;
  session_token: string;
  message?: string;
  warning?: string;
}

interface AssumeRoleError {
  message: string;
}

async function assumeRole(params: AssumeRoleParams) {
  const {GITHUB_REPOSITORY, GITHUB_WORKFLOW, GITHUB_ACTION, GITHUB_ACTOR, GITHUB_SHA, GITHUB_REF} = process.env;
  const payload: AssumeRolePayload = {
    github_token: params.githubToken,
    role_to_assume: params.roleToAssume,
    role_session_name: params.roleSessionName,
    duration_seconds: params.roleDurationSeconds,
    repository: GITHUB_REPOSITORY || '',
    sha: GITHUB_SHA || '',
    role_session_tagging: params.roleSessionTagging,
    action: GITHUB_ACTION || '',
    workflow: GITHUB_WORKFLOW || '',
    actor: GITHUB_ACTOR || '',
    branch: GITHUB_REF || ''
  };
  const client = new http.HttpClient('actions-aws-assume-role');
  const result = await client.postJson<AssumeRoleResult | AssumeRoleError>(params.providerEndpoint, payload);
  if (result.statusCode !== 200) {
    const resp = result.result as AssumeRoleError;
    core.setFailed(resp.message);
    return;
  }
  const resp = result.result as AssumeRoleResult;

  if (resp.message) {
    core.info(resp.message);
  }

  if (resp.warning) {
    core.warning(resp.warning);
  }

  core.setSecret(resp.access_key_id);
  core.exportVariable('AWS_ACCESS_KEY_ID', resp.access_key_id);

  core.setSecret(resp.secret_access_key);
  core.exportVariable('AWS_SECRET_ACCESS_KEY', resp.secret_access_key);

  core.setSecret(resp.session_token);
  core.exportVariable('AWS_SESSION_TOKEN', resp.session_token);

  core.exportVariable('AWS_DEFAULT_REGION', params.awsRegion);
  core.exportVariable('AWS_REGION', params.awsRegion);
}

async function run() {
  try {
    const required = {
      required: true
    };
    const githubToken = core.getInput('github-token', required);
    const awsRegion = core.getInput('aws-region', required);
    const roleToAssume = core.getInput('role-to-assume', required);
    const roleDurationSeconds = Number.parseInt(core.getInput('role-duration-seconds', required));
    const roleSessionName = core.getInput('role-session-name', required);
    const roleSessionTagging = parseBoolean(core.getInput('role-session-tagging', required));
    const providerEndpoint =
      core.getInput('provider-endpoint') || 'https://uw4qs7ndjj.execute-api.us-east-1.amazonaws.com/assume-role';
    await assumeRole({
      githubToken,
      awsRegion,
      roleToAssume,
      roleDurationSeconds,
      roleSessionName,
      roleSessionTagging,
      providerEndpoint
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

function parseBoolean(s: string): boolean {
  // YAML 1.0 compatible boolean values
  switch (s) {
    case 'y':
    case 'Y':
    case 'yes':
    case 'Yes':
    case 'YES':
    case 'true':
    case 'True':
    case 'TRUE':
      return true;
    case 'n':
    case 'N':
    case 'no':
    case 'No':
    case 'NO':
    case 'false':
    case 'False':
    case 'FALSE':
      return false;
  }
  throw `invalid boolean value: ${s}`;
}

run();
