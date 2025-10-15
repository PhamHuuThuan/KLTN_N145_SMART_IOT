import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-strong-secret');
    req.user = {
      ...decoded,
      userId: decoded.userId || decoded.sub,
      id: decoded.sub || decoded.userId
    };
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

export const authorizeOwner = (req, res, next) => {
  const { ownerId } = req.params;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: 'User not authenticated' 
    });
  }

  if (ownerId && ownerId !== userId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied: Not the owner of this resource' 
    });
  }

  next();
};
