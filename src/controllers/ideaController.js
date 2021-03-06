const ideaValid = require('../utils/ideaValid');

//import middleware
const catchAsyncError = require('../helpers/catchAsyncError');

//Import Model
const ideaModel = require('../models/ideaModel');
const Filter = require('../utils/filter');
const userModel = require('../models/userModel');
const submissionModel = require('../models/submissionModel');
const reactionModel = require('../models/reactionModel');
const categoryModel = require('../models/categoryModel');
const pageIndex = require('../utils/PageIndex');
const { default: mongoose, mongo } = require('mongoose');
const mailNotice = require('../utils/mailNotice')

const ideaController = {
  create: catchAsyncError(async (req, res) => {
    //get info idea to create
    const {
      title,
      description,
      content,
      user_id,
      category_id,
      submission_id,
      anonymously,
      files,
      cloudinary_id,
    } = req.body;

    //check valid info input
    const errMsg = ideaValid.ideaFillIn({
      title,
      description,
      content,
      user_id,
      category_id,
      submission_id,
    });

    if (errMsg)
      return res.status(400).json({
        err: errMsg,
        statusCode: 400,
      });

    //Check exist user
    const user = await userModel.findById(user_id);

    if (!user)
      return res.status(400).json({
        err: 'User does not exist in system.',
        statusCode: 400,
      });

    //Check exist category
    if (category_id) {
      const category = await categoryModel.findById(category_id);
      if (!category)
        return res.status(400).json({
          err: 'Category does not exist in system.',
          statusCode: 400,
        });
    }

    //Check exist submission
    const submission = await submissionModel.findById(submission_id);
    if (!submission)
      return res.status(400).json({
        err: 'Submission does not exist in system.',
        statusCode: 400,
      });

    //Check time closure date
    const checkTimeClosure = new Date(submission.closure_date) > new Date();
    if (!checkTimeClosure)
      return res.status(400).json({
        err: 'The closure timeout date has expired.',
        statusCode: 400,
      });

    // send mail
    const QACoordinator = await userModel.findOne({ role: 'qa_coordinator', department_id: user.department_id })
    if (QACoordinator) {
      await mailNotice({
        email: QACoordinator.email,
        subject: `1 staff posted an idea`,
        text: `${user.email} posted 1 new idea.`,
        html: '',
      });
    }

    const NewIdea = new ideaModel({
      title,
      description,
      content,
      user_id,
      category_id: category_id ? category_id : null,
      submission_id,
      anonymously,
      files,
      cloudinary_id,
    });
    await NewIdea.save();

    return res.status(200).json({
      msg: 'Create idea success!',
      statusCode: 200,
    });
  }),

  update: catchAsyncError(async (req, res) => {
    //get id from query
    const { id } = req.params;

    //get info update
    const { title, description, content, category_id, anonymously, files, cloudinary_id } =
      req.body;

    //check idea exist in system
    const idea = await ideaModel.findById(id);

    if (!idea) {
      return res.status(400).json({
        err: 'The Idea does not exist',
        statusCode: 400,
      });
    }

    //Get submission to check time
    if (idea.submission_id) {
      const submission = await submissionModel.findById(idea.submission_id);

      //Check time closure date
      const checkTimeClosure = new Date(submission.closure_date) > new Date();
      if (!checkTimeClosure)
        return res.status(400).json({
          err: 'The closure timeout date has expired, you can not update idea.',
          statusCode: 400,
        });
    }

    if (category_id) {
      //check category exist in system
      const category = await categoryModel.findById(category_id);

      if (!category) {
        return res.status(400).json({
          err: 'The category does not exist',
          statusCode: 400,
        });
      }
    }

    //Check valid data
    const ideaErr = ideaValid.ideaUpdate({
      title,
      description,
      content,
    });

    if (ideaErr)
      return res.status(400).json({
        statusCode: 400,
        err: ideaErr,
      });

    //Update and response
    await ideaModel.findByIdAndUpdate(id, {
      title,
      description,
      content,
      category_id: category_id ? category_id : null,
      anonymously,
      files,
      cloudinary_id: cloudinary_id ? cloudinary_id : null,
      accept: false,
    });

    return res.status(200).json({
      statusCode: 200,
      msg: 'Update Success',
    });
  }),

  delete: catchAsyncError(async (req, res) => {
    const { id } = req.params;

    //check idea exist in system
    const idea = await ideaModel.findById(id);

    if (!idea)
      return res.status(400).json({
        err: 'The idea does not exist',
        statusCode: 400,
      });
    await ideaModel.findByIdAndDelete(id, req.body);

    return res.status(200).json({
      statusCode: 200,
      msg: 'Delete Success',
    });
  }),



  getAll: catchAsyncError(async (req, res) => {

    const {
      _sort,
      _sortBy,
      _limit,
      _page,
      _nameById,
      _valueById,
      _interactive,
      _reaction,
      _search,
      _accept,
      _getBy,
      _getValue,
    } = req.query;

    if (_interactive || _reaction) {
      const match = () => {
        let filter = {
          reactionType_id: _reaction ? _reaction : { $nin: [''] },
        }
        if (_accept) {
          filter = {
            ...filter,
            'idea.accept': true
          }
        }
        if (_getBy && _getValue) {
          filter = {
            ...filter,
            [_getBy]: _getValue
          }
        }

        return {
          $match: {
            ...filter
          }
        }

      };
      const page = await reactionModel.aggregate([
        {
          $addFields: { idea_id2: { $toObjectId: '$idea_id' } },
        },
        {
          $lookup: {
            from: 'ideas',
            localField: 'idea_id2',
            foreignField: '_id',
            as: 'idea',
          },
        },
        {
          $unwind: {
            path: '$idea',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: { person_id: { $toString: '$idea.user_id' }, submission_id: { $toString: '$idea.submission_id"' } },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'idea.user_id',
            foreignField: '_id',
            as: 'idea.user',
          },
        },

        match(),
        {
          $group: {
            _id: '$idea_id',
          },
        },
        {
          $count: 'totalPage',
        },
      ]);

      const result = await reactionModel.aggregate([
        {
          $addFields: { idea_id2: { $toObjectId: '$idea_id' } },
        },
        {
          $lookup: {
            from: 'ideas',
            localField: 'idea_id2',
            foreignField: '_id',
            as: 'idea',
          },
        },
        {
          $unwind: {
            path: '$idea',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: { person_id: { $toString: '$idea.user_id' }, submission_id: { $toString: '$idea.submission_id"' } },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'idea.user_id',
            foreignField: '_id',
            as: 'idea.user',
          },
        },
        match(),
        {
          $group: {
            _id: '$idea',
            totalReaction: { $sum: 1 },
          },
        },
        {
          $sort: {
            totalReaction: -1,
          },
        },

        {
          $skip: Number(_page - 1) * Number(_limit),
        },
        {
          $limit: Number(_limit),
        },
      ]);

      let data = result.map((item) => {
        return {
          ...item._id,
          totalReaction: item.totalReaction,
          user_id: item._id.user[0],
        };
      });



      return res.status(200).json({
        statusCode: 200,
        msg: 'Get All Success',
        ideas: data,
        page_Index: page.length == 0 ? 0 : Math.ceil(page[0].totalPage / Number(_limit)),
      });
    }

    let filter = new Filter(ideaModel);
    let countPage = new Filter(ideaModel);
    if (_accept) {
      filter = filter.getAll({
        accept: true,
      });
      countPage = countPage.getAll({
        accept: true,
      });

    } else {
      filter = filter.getAll();
      countPage = countPage.getAll();
    }
    if (_nameById) {
      filter = filter.searchById({ name: _nameById, value: _valueById });
      countPage = countPage.searchById({ name: _nameById, value: _valueById });
    }
    if (_search) {
      filter = filter.search({ name: 'title', query: _search });
      countPage = countPage.search({ name: 'title', query: _search });
    }
    if (_sort) {
      filter = filter.sort({ name: _sortBy, NorO: _sort });
      countPage = countPage.sort({ name: _sortBy, NorO: _sort });
    }
    if (_getBy && _getValue) {
      if (_getBy == 'person_id') {
        filter = filter.searchById({ name: 'user_id', value: _getValue });
        countPage = countPage.searchById({ name: 'user_id', value: _getValue });
      } else {
        filter = filter.searchById({ name: _getBy, value: _getValue });
        countPage = countPage.searchById({ name: _getBy, value: _getValue });
      }
    }

    // get Count Item
    const count = await countPage.query.count()
    const page_Index = pageIndex({ count, limit: _limit });
  
    if (_page && _limit) {
      filter = filter.pagination({ page: _page - 1, limit: _limit });
    }

    let data = await filter.query.populate('user_id');

    return res.status(200).json({
      statusCode: 200,
      msg: 'Get All Success',
      ideas: data,
      page_Index,
    });
  }),

  getDetail: catchAsyncError(async (req, res) => {
    const { id } = req.params;

    const idea = await ideaModel
      .findById(id)
      .populate('user_id')
      .populate('category_id')
      .populate('submission_id');

    if (!idea)
      return res.status(400).json({
        err: 'The Idea does not exist',
        statusCode: 400,
      });

    const countReactions = await reactionModel.aggregate([
      {
        $match: {
          idea_id: id,
        },
      },
      {
        $group: {
          _id: '$reactionType_id',
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      statusCode: 200,
      msg: ' Get topic success',
      idea,
      countReactions,
    });
  }),

  deleteFile: catchAsyncError(async (req, res) => {
    const { public_id, id } = req.body;
    await ideaModel.findByIdAndUpdate(id, { $pull: { files: { public_id } } });
    return res.status(200).json({
      statusCode: 200,
      msg: 'Delete file success',
    });
  }),
  getIdeaOfUser: catchAsyncError(async (req, res) => {
    const { user_id } = req.params;
    const { submission_id } = req.query;

    const user = await userModel.findById(user_id);

    if (!user)
      return res.status(400).json({
        err: 'The user id dose not exist',
        statusCode: 400,
      });

    const submission = await submissionModel.findById(submission_id);
    if (!submission)
      return res.status(400).json({
        err: 'The submission id dose not exist',
        statusCode: 400,
      });

    const ideas = await ideaModel.find({ submission_id, user_id }).populate('category_id');
    return res.status(200).json({
      msg: 'Get ideas by user success',
      statusCode: 200,
      ideas,
    });
  }),

  getIdeaAcceptOfUser: catchAsyncError(async (req, res) => {
    const { user_id } = req.params;

    const user = await userModel.findById(user_id);

    if (!user)
      return res.status(400).json({
        err: 'The user id dose not exist',
        statusCode: 400,
      });

    const ideas = await ideaModel
      .find({ user_id, accept: true, anonymously: false })
      .populate('category_id');
    return res.status(200).json({
      msg: 'Get ideas accept by user success',
      statusCode: 200,
      ideas,
    });
  }),

  setAccept: catchAsyncError(async (req, res) => {
    const { id_idea } = req.body;
    const idea = await ideaModel.findById(id_idea);
    if (!idea) {
      return res.status(400).json({
        err: 'Idea not found',
        statusCode: 400,
      });
    }

    await ideaModel.findByIdAndUpdate(id_idea, {
      accept: true,
    });

    return res.status(200).json({
      msg: 'Update accept success',
      statusCode: 200,
    });
  }),
};

module.exports = ideaController;

