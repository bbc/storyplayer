pipeline {
  agent {
    docker { image 'node:10' }
  }

  stages {
    stage('Debug') {
      steps {
        sh '''
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
