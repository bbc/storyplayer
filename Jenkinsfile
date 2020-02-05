@Library("rd-apmm-groovy-ci-library@v1.x") _

pipeline {
  agent {
    docker {
      image 'node:10'
      label 'apmm-slave'
      args '-v /etc/pki:/etc/pki'
    }
  }

  environment {
    // Jenkins sets the container user to `jenkins`. In the absence of a real
    // user with a real home dir, npm looks for startup files (e.g. .npmrc)
    // under /, which causes the container to bomb out with a permissions
    // error.  Setting $HOME fixes this.
    HOME = "$PWD"
    http_proxy = "http://www-cache.rd.bbc.co.uk:8080"
    https_proxy = "http://www-cache.rd.bbc.co.uk:8080"
    NODE_ENV = "production"
  }

  stages {
    stage('Set Yarn and NPM config') {
      steps {
        withBBCRDJavascriptArtifactory {
          sh '''
            yarn config set proxy http://www-cache.rd.bbc.co.uk:8080/
            yarn config set https-proxy http://www-cache.rd.bbc.co.uk:8080/
            yarn config set registry https://artifactory.virt.ch.bbc.co.uk/artifactory/api/npm/cosmos-npm/

            npm config set proxy http://www-cache.rd.bbc.co.uk:8080/
            npm config set https-proxy http://www-cache.rd.bbc.co.uk:8080/
          '''
        }
      }
    }
    stage('Discover package versions') {
      steps {
        withBBCRDJavascriptArtifactory {
          script {
            env.package_name = sh(returnStdout: true, script: '''node -p "require('./package.json').name"''')
            env.git_version = sh(returnStdout: true, script: '''node -p "require('./package.json').version"''')
            env.npm_version = sh(returnStdout: true, script: 'npm show "$package_name" version || echo 0.0.0')
            env.artifactory_version = sh(returnStdout: true, script: 'npm show "$package_name" version --reg "$artifactory" || echo 0.0.0')

            println """
                      |----------------
                      |-- BUILD INFO --
                      |----------------
                      |
                      |Package name:        ${package_name}
                      |Git version:         $git_version
                      |NPM version:         $npm_version
                      |Artifactory version: $artifactory_version""".stripMargin()
          }
        }
      }
    }
    stage('Publish to NPMjs Private') {
      when { not { equals expected: env.git_version, actual: env.npm_version } }
      steps {
        withBBCRDJavascriptArtifactory {
          sh 'echo npm publish'
        }
      }
    }
    stage('Publish to Artifactory Private') {
      when { not { equals expected: env.git_version, actual: env.artifactory_version } }
      steps {
        withBBCRDJavascriptArtifactory {
          sh 'echo artifactory publish'
        }
      }
    }
  }
}
