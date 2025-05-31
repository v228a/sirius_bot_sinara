import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';

interface ModalTelegramExportProps {
  open: boolean;
  onClose: () => void;
  code: string;
}

export const ModalTelegramExport = ({ open, onClose, code }: ModalTelegramExportProps) => {
  const theme = useTheme();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Код вашего telegram-бота:
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{
          background: theme.palette.mode === 'dark' ? '#222' : '#f5f5f5',
          borderRadius: 2,
          p: 2,
          mb: 3,
          fontFamily: 'monospace',
          fontSize: 14,
          overflowX: 'auto',
          whiteSpace: 'pre',
          maxHeight: 320,
        }}>
          {code}
        </Box>
        <Typography variant="subtitle1" gutterBottom>Для получения API-токена выполните следующие шаги:</Typography>
        <Typography component="ol" sx={{ pl: 3, mb: 2 }}>
          <li>Откройте приложение Telegram и войдите в аккаунт.</li>
          <li>Найдите в поиске бота <b>@BotFather</b>.</li>
          <li>Нажмите на найденного бота и нажмите кнопку "Start".</li>
          <li>Отправьте команду <b>/newbot</b> для создания нового бота.</li>
          <li>Введите имя вашего бота.</li>
          <li>Придумайте уникальное имя пользователя бота, оканчивающееся на "bot".</li>
          <li>BotFather отправит вам сообщение с токеном доступа, который начинается с "bot".</li>
          <li>Скопируйте полученный токен и сохраните его в безопасном месте.</li>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          API-токен, полученный от BotFather, является ключом к вашему боту и необходим для авторизации в Telegram API.<br/>
          Используйте его в разработке ботов для Telegram, чтобы отправлять сообщения, получать обновления и выполнять другие операции через мессенджер.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}; 