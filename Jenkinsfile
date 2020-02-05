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
  }

  stages {
    stage('Debug') {
      steps {
        withBBCRDJavascriptArtifactory {
          sh '''
            yarn config set proxy http://www-cache.rd.bbc.co.uk:8080/
            yarn config set https-proxy http://www-cache.rd.bbc.co.uk:8080/
            yarn config set registry https://artifactory.virt.ch.bbc.co.uk/artifactory/api/npm/cosmos-npm/

            package_name=$(node -p "require('./package.json').name")
            git_version=$(node -p "require('./package.json').version")
            # Latest version published to BBC npm org
            npm_version=$(npm show ${package_name} version || echo 0.0.0)
            # Latest version published to Artifactory
            artifactory_version=$(npm show ${package_name} version --reg ${artifactory} || echo 0.0.0)

            echo "Package name: $package_name"
            echo "Git version: $git_version"
            echo "NPM version: $npm_version"
            echo "Artifactory version: $artifactory_version"
          '''
        }
      }
    }
  }
}
