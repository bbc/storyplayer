@Library("rd-apmm-groovy-ci-library@v1.x") _

pipeline {
  agent {
    dockerfile {
      label 'apmm-slave'
      args '--mount type=bind,source=/etc/pki,target=/etc/pki'
    }
  }

  options {
      ansiColor('xterm') // Add support for coloured output
  }

  environment {
    artifactory_publish = "https://artifactory.virt.ch.bbc.co.uk/artifactory/api/npm/uxcs-cosmos-npm/"
    artifactory_pull = "https://artifactory.virt.ch.bbc.co.uk/artifactory/api/npm/cosmos-npm/"
    NODE_ENV = "production"
    NODE_OPTIONS = "--max-old-space-size=4096"

    GIT_SSH_COMMAND = 'ssh -o ProxyCommand="nc -x socks-gw.rd.bbc.co.uk -X 5 %h %p"'
  }

  stages {

    stage('Configure token auth for NPMjs') {
      steps {
        script {
          withCredentials([string(credentialsId: 'npm-auth-token', variable: 'NPM_TOKEN')]) {
            sh 'echo //registry.npmjs.org/:_authToken=$NPM_TOKEN >> $HOME/.npmrc'
          }
        }
      }
    }

    stage('Configure mutual TLS for Artifactory') {
      steps {
        sh '''
          set +x
          npm config set cert -- "$(cat /etc/pki/tls/certs/client.crt)"
          npm config set key -- "$(cat /etc/pki/tls/private/client.key)"
          yarn config set cert --silent -- "$(cat /etc/pki/tls/certs/client.crt)"
          yarn config set key --silent -- "$(cat /etc/pki/tls/private/client.key)"
        '''
      }
    }

    stage('Discover package versions') {
      steps {
        script {
          env.package_name = sh(returnStdout: true, script: '''node -p "require('./package.json').name"''')
          env.git_version = sh(returnStdout: true, script: '''node -p "require('./package.json').version"''')

          env.npm_version = sh(returnStdout: true, script: 'npm show "$package_name" --reg https://registry.npmjs.org/ version || echo 0.0.0')

          env.artifactory_version = sh(returnStdout: true, script: 'npm show "$package_name" version --reg "$artifactory_publish" || echo 0.0.0')

          env.last_version_commit_id = sh(returnStdout: true, script: 'git log -L 3,3:package.json | grep -e "^commit [0-9a-z]*$" | head -n 2 | tail -1 | awk \'{print $2}\'')
          env.commit_messages = sh(returnStdout: true, script: 'git log --pretty=oneline $(git log -L 3,3:package.json | grep -e "^commit [0-9a-z]*$" | head -n 2 | tail -1 | awk \'{print $2}\')...master')

          println """
                    |----------------
                    |-- BUILD INFO --
                    |----------------
                    |
                    |Package name:        ${package_name}
                    |Git version:         $git_version
                    |NPM version:         $npm_version
                    |Artifactory version: $artifactory_version""".stripMargin()

          println """
                    |-----------------
                    |-- COMMIT INFO --
                    |-----------------
                    |
                    |Last Version Commit:        ${last_version_commit_id}
                    |Commit List:                ${commit_messages}""".stripMargin()
        }
      }
    }

    stage('Publish to NPMjs Private') {
      when {
        allOf {
          branch 'master';
          not { equals expected: env.git_version, actual: env.npm_version }
        }
      }
      steps {
        script {
          withCredentials([string(credentialsId: 'npm-auth-token', variable: 'npm_token')]) {
            sh 'npm publish --access restricted'
          }
        }
      }
    }

    stage('Publish to Artifactory Private') {
      steps {
        // credential ID lifted from https://github.com/bbc/rd-apmm-groovy-ci-library/blob/a4251d7b3fed3511bbcf045a51cfdc86384eb44f/vars/bbcParallelPublishNpm.groovy#L32
        withBBCGithubSSHAgent {
          sh '''
            git config --global user.name "Jenkins"
            git config --global user.email jenkins-slave@rd.bbc.co.uk
            git clone git@github.com:bbc/rd-ux-storyplayer-harness.git
            git clone git@github.com:bbc/rd-ux-storyformer.git
          '''

          dir('rd-ux-storyplayer-harness') {
            sh '''
              yarn add --registry "$artifactory_pull" --dev --ignore-scripts @bbc/storyplayer
              git add package.json yarn.lock
              yarn version --patch --message  "chore: Upgrade storyplayer to ${git_version} and version bump to %s

${commit_messages}
"
              git log
            '''
          }

          dir('rd-ux-storyformer') {
            sh '''
              yarn add --registry "$artifactory_pull" --dev --ignore-scripts @bbc/storyplayer
              git add package.json yarn.lock
              yarn version --patch --message  "chore: Upgrade storyplayer to ${git_version} and version bump to %s

${commit_messages}
"
              git log
            '''
          }
        }
      }
    }
  }
  post {
    always {
      cleanWs()
    }
  }
}
