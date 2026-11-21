const authService = require('../services/authService');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated.',
        });
      }
      const user = await authService.getUserById(req.user.id);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res) {
    // For JWT, client discards token; optionally blacklist or return success
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  }
}

module.exports = new AuthController();
