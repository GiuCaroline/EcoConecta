FROM node:22-alpine

# Instala python3 e dependencias basicas caso necessarias
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copia arquivos de definicao de pacotes
COPY package*.json ./

# Instala apenas dependencias de producao
RUN npm install --omit=dev

# Copia o restante do codigo-fonte do backend
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
