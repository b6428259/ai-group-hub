pipeline {
  agent any

  options {
    disableConcurrentBuilds()
  }

  triggers {
    githubPush()
  }

  environment {
    IMAGE_NAME = 'ai-group-hub-backend'
    CONTAINER_NAME = 'ai-group-backend'
    APP_PORT = '3002'
    WORKSPACE_HOST_PATH = '/var/lib/docker/volumes/jenkins_home/_data/workspace/ai-group-hub'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build Image') {
      steps {
        sh '''
          set -euxo pipefail
          docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest .
        '''
      }
    }

    stage('Deploy Container') {
      steps {
        sh '''
          set -euxo pipefail
          docker rm -f ${CONTAINER_NAME} || true
          docker run -d \
            --name ${CONTAINER_NAME} \
            --restart always \
            -e PORT=3000 \
            -e OPENCLAW_MODELS_PATH=/app/config/models.json \
            -v ${WORKSPACE_HOST_PATH}/models.json:/app/config/models.json:ro \
            -p ${APP_PORT}:3000 \
            ${IMAGE_NAME}:latest
        '''
      }
    }

    stage('Health Check') {
      steps {
        sh '''
          set -euxo pipefail
          for i in $(seq 1 10); do
            if [ "$(docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME} 2>/dev/null || true)" = "true" ]; then
              exit 0
            fi
            sleep 3
          done
          exit 1
        '''
      }
    }
  }

  post {
    always {
      sh 'docker ps --filter name=${CONTAINER_NAME} --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}" || true'
    }
  }
}
