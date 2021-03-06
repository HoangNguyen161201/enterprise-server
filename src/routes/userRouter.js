const express = require('express');
const { staticUser } = require('../controllers/userController');

//Import controllers
const userController = require('../controllers/userController');

//Create user router
const userRouter = express.Router();

//Import middleware
const authorization = require('../middlewares/authorization');

//Handle user routes
userRouter.post('/', authorization(['admin', 'qa_manager']), userController.create);

userRouter.post('/add-many', authorization(['admin', 'qa_manager']), userController.CreateMany);

userRouter.post('/assign', authorization(['admin', 'qa_manager']), userController.assignDepartment);

userRouter.post('/static', staticUser)

userRouter.post(
  '/assign-many',
  authorization(['admin', 'qa_manager']),
  userController.manyAssignDepartment
);

userRouter.post(
  '/remove-assign-many',
  authorization(['admin', 'qa_manager']),
  userController.removeManyAssignDepartment
);

userRouter.post('/delete-many', authorization(['admin', 'qa_manager']), userController.deleteMany);

userRouter.put('/:id', authorization(['admin', 'qa_manager']), userController.update);

userRouter.put('/avatar/:user_id', authorization([]), userController.updateAvatar);

userRouter.put('/contact/:user_id', userController.updateContact);

userRouter.delete(
  '/remove-assign/:id',
  authorization(['admin', 'qa_manager']),
  userController.removeAssignDepartment
);

userRouter.delete('/:id', authorization(['admin', 'qa_manager']), userController.delete);

userRouter.get('/', authorization([]), userController.getAll);

userRouter.get('/role/:role', authorization([]), userController.getRole);

userRouter.get('/not-department', authorization([]), userController.getNotDepartment);

userRouter.get('/:id', authorization([]), userController.getDetail);

module.exports = userRouter;
