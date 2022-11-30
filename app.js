const express = require("express");
const jwt = require("jsonwebtoken");
const { User, Post, Comment } = require("./models");
const authMiddleware = require("./middlewares/auth-middleware");
const Joi = require('joi')
const { Op } = require("sequelize");

const app = express();
app.use(express.json())
const router = express.Router();

const postUsersSchema = Joi.object({
  nickname: Joi.string().required(),
  password: Joi.string().required(),
  confirmPassword: Joi.string().required(),
});

// User Registration
router.post("/signup", async (req, res) => {
  try {
    const { nickname, password, confirmPassword } = await postUsersSchema.validateAsync(req.body);
    if (password !== confirmPassword) {
      res.status(400).send({
        errorMessage: "Password is not the same as password checkbox",
      });
      return;
    }

    const existUsers = await User.findAll({
      where: {
        [Op.or]: [{ nickname }],
      }
    });

    if (existUsers.length) {
      res.status(400).send({
        errorMessage: "You have already registered an nickname.",
      });
      return;
    }
    await User.create({ nickname, password });
    res.status(201).send({});

  } catch (error) {
    console.log(error)
    res.status(400).send({
      errorMessage: 'The request data is not valid'
    })
  }
});

// User Auth
const postAuthSchema = Joi.object({
  nickname: Joi.string().required(),
  password: Joi.string().required(),
});

router.post("/login", async (req, res) => {
  try {
    const { nickname, password } = await postAuthSchema.validateAsync(req.body);
    const user = await User.findOne({
      where: {
        nickname,
      },
    });

    if (!user || password !== user.password) {
      res.status(400).send({
        errorMessage: "Invalid nickname or password.",
      });
      return;
    }

    const token = jwt.sign({ userId: user.userId }, "customized-secret-key");
    res.send({
      token,
    });

  } catch (error) {
    console.log(error)
    res.status(400).send({
      errorMessage: 'The request data is not complete'
    })
  }
});

router.get("/users/me", authMiddleware, async (req, res) => {
  const { user } = res.locals;
  res.send({
    user,
  });
});

/**
 * Get all goods
 * Pagination is a luxury for us, who have few products.
 * @example
 * /api/goods
 * /api/goods?category=drink
 * /api/goods?category=drink2
 */
router.post('/create-post', async (req, res) => {
  await Post.create({ "title": "title A", "content": "lorem ipsum dolor sir amet", "like": 0 })
  await Post.create({ "title": "title B", "content": "lorem ipsum dolor sir amet", "like": 0 })
  await Post.create({ "title": "title C", "content": "lorem ipsum dolor sir amet", "like": 0 })
  await Post.create({ "title": "title D", "content": "lorem ipsum dolor sir amet", "like": 0 })
  res.send('done')
})

router.get("/posts", authMiddleware, async (req, res) => {
  const posts = await Post.findAll({
    order: [['postId', 'DESC']],
  })

  res.send({ posts });
});

/**
 * Bring only one product
 */
router.get("/posts/:postId", authMiddleware, async (req, res) => {
  const { postId } = req.params;
  const posts = await Post.findByPk(postId)

  if (!posts) {
    res.status(404).send({});
  } else {
    res.send({ posts });
  }
});

/**
 * I load all the shopping cart lists I have.
 */
router.get("/goods/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;

  const cart = await Cart.findAll({
    where: {
      userId,
    }
  }).exec();

  const goodsIds = cart.map((c) => c.goodsId);

  // To reduce the loop, make it a mappable object
  const goodsKeyById = await Goods.findAll({
    where: {
      goodsId: goodsIds

    }
  })
    .then((goods) =>
      goods.reduce(
        (prev, g) => ({
          ...prev,
          [g.goodsId]: g,
        }),
        {}
      )
    );

  res.send({
    cart: cart.map((c) => ({
      quantity: c.quantity,
      goods: goodsKeyById[c.goodsId],
    })),
  });
});

/**
 * Add product to cart.
 * If the product is already in the shopping cart, only the number is modified.
 */
router.put("/goods/:goodsId/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;
  const { quantity } = req.body;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    }
  })

  if (existsCart) {
    existsCart.quantity = quantity;
    await existsCart.save();
  } else {
    await Cart.create({
      userId,
      goodsId,
      quantity,
    });
  }

  // NOTE: When successful, the response value is not used by the client.
  res.send({});
});

/**
 * Delete cart items
 */
router.delete("/goods/:goodsId/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    }
  })

  // It doesn't matter if it is or not. just delete it
  if (existsCart) {
    await existsCart.destroy();
  }

  // NOTE: There is no specific response value when successful.
  res.send({});
});

app.use("/api", express.urlencoded({ extended: false }), router);
app.use(express.static("assets"));
app.use(express.json())

app.listen(8080, () => {
  console.log("The server is ready to receive the request");
});