import jwt from 'jsonwebtoken';

export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
}


export const exigirPerfil = (...perfis) => (req, res, next) => {
  if (!perfis.includes(req.usuario?.perfil)) {
    return res.status(403).json({ erro: 'Sem permissão para esta ação.' });
  }
  next();
};