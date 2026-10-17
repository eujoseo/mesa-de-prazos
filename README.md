# Mesa de Prazos

Controle dos prazos das substituições (GAECO, Caaporã e Guarabira) em uma página só. Ela lê a caixa do PJe e a agenda em PDF, calcula as metas, tem checklist diário, lembretes e cronômetros da jornada.

Tudo fica salvo automaticamente no navegador. Com o Google Drive conectado, cada alteração também é gravada no arquivo `mesa-de-prazos.json` do seu Drive, e ao abrir em outro computador ou no celular a versão mais recente é carregada.

## 1. Publicar no GitHub Pages (5 minutos)

1. Entre em https://github.com e crie um repositório novo, por exemplo `mesa-de-prazos`. Ele pode ser **privado** se o seu plano permitir Pages privado; senão, deixe público. Os dados **não** ficam no repositório, só no seu navegador e no seu Drive.
2. No repositório, clique em **Add file → Upload files** e envie `index.html` e `README.md`. Só esses dois bastam.
3. Vá em **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
4. Em 1 ou 2 minutos aparece o endereço, algo como `https://SEU-USUARIO.github.io/mesa-de-prazos/`. Guarde esse endereço.

## 2. Ligar o Google Drive (uma vez só)

O Google exige um "Client ID" para que a página possa gravar no seu Drive.

1. Acesse https://console.cloud.google.com e crie um projeto (ex.: "Mesa de Prazos").
2. Em **APIs e serviços → Biblioteca**, procure **Google Drive API** e clique em **Ativar**.
3. Em **APIs e serviços → Tela de consentimento OAuth**:
   - escolha **Externo**;
   - preencha nome do app e seu e-mail;
   - em **Usuários de teste**, adicione o seu próprio Gmail.
4. Em **APIs e serviços → Credenciais**:
   - clique em **Criar credenciais → ID do cliente OAuth** e escolha o tipo **Aplicativo da Web**;
   - em **Origens JavaScript autorizadas**, adicione `https://SEU-USUARIO.github.io` (sem a parte `/mesa-de-prazos/`);
   - clique em **Criar** e copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).
5. Abra a Mesa de Prazos e vá em **Ajustes → Backup e Google Drive**. Cole o ID do cliente e clique em **Conectar ao Google Drive**. Na janela do Google, permita o acesso.

Pronto. O status no rodapé passa a mostrar "Salvo neste navegador e no Google Drive". A página só enxerga os arquivos que ela mesma criou no seu Drive (permissão `drive.file`); o restante do Drive fica fora do alcance dela.

Observações:
- Enquanto o app estiver em modo "teste" no Google, ele pode pedir para você confirmar o acesso de tempos em tempos; é só clicar em **Sincronizar agora**.
- Você pode mover o arquivo `mesa-de-prazos.json` para a pasta que quiser no Drive; a sincronização continua.

## 3. Segurança extra

Em **Ajustes**, o botão **Baixar backup (.json)** salva uma cópia completa (expedientes, feitos, lembretes, checklist e cronômetros). **Restaurar backup** traz tudo de volta. Vale baixar um backup no fim de cada semana.

## Atualizar a página

Quando receber um `index.html` novo, repita o passo 1.2 (Upload files) substituindo o arquivo. Seus dados não são afetados.
