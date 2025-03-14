// requiring dependencies, models and middlewares
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const auth = require('../middlewares/auth');
const Blog = require('../models/Blog.model');

const router = express.Router();

// GET request for Sign Up
router.get('/sign-up', auth, async (req, res) => {
    if (req.user) {
        res.redirect('/');
    } else {
        res.render('./auth/signUp', {
            error: '',
            data: {
                firstName: '',
                lastName: '',
                userName: '',
                password: '',
                email: '',
                confirmPassword: '',
            },
        });
    }
});

// GET request for Log In
router.get('/log-in', auth, async (req, res) => {
    if (req.user) {
        res.redirect('/');
    } else {
        res.render('./auth/logIn', {
            error: '',
            data: {
                email: '',
                password: '',
            },
        });
    }
});

// to view own profile
router.get('/read-profile', auth, async (req, res) => {
    const _id = req.user;
    const user = await User.findById(_id);
    const blogs = await Blog.find({ author: req.params.id })
        .populate('author')
        .sort({ timestamps: 'desc' })
        .lean();
    res.render('./useritems/read-profile', {
        user,
        blogs,
        isAuthenticated: !!req.user,
    });
});

router.post('/read-profile', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
        'firstName',
        'lastName',
        'userName',
        'email',
        'password',
    ];
    const isValid = updates.every((update) => allowedUpdates.includes(update));

    if (!isValid) {
        res.status(400).send('invalid update property');
    }

    try {
        const id = await req.user;
        const user = await User.findById(id._id);
        updates.forEach((update) => (user[update] = req.body[update]));
        await user.save();
        res.redirect('/');
    } catch (e) {
        res.status(500).send(e);
    }
});

// POST request for sign up
router.post('/sign-up', async (req, res) => {
    const {
        firstName,
        lastName,
        userName,
        email,
        password,
        confirmPassword,
    } = req.body;

    // Check if all the fields are filled
    if (
        !firstName ||
        !lastName ||
        !userName ||
        !email ||
        !password ||
        !confirmPassword
    ) {
        return res.status(422).render('./auth/signUp', {
            error: 'Please add all the fields!',
            data: {
                firstName: firstName || '',
                lastName: lastName || '',
                userName: userName || '',
                email: email || '',
                password: password || '',
                confirmPassword: confirmPassword || ' ',
            },
        });
    }

    const emailRegx = new RegExp(
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/
    );
    const pwdRegex = new RegExp(
        /^(?=.*\d)(?=.*[!@#$%^&*])(?=.*[a-z])(?=.*[A-Z]).{8,}$/
    );
    const firstAndLastNameRegex = new RegExp(/^[a-zA-Z]+$/);
    if (userName.length < 6 || userName.length > 12) {
        return res.status(500).render('./auth/signUp', {
            error: 'Username should be between 6 to 12 character',
            data: {
                firstName,
                lastName,
                userName,
                email,
                password,
                confirmPassword,
            },
        });
    }

    //Validation for firstName which accept only alphabet character
    //call trim method on firstName if user by mistake give space after or before firstName

    if (!firstAndLastNameRegex.test(firstName.trim())) {
        return res.status(500).render('./auth/signUp', {
            error: 'First Name must contain only alphabet character',
            data: {
                firstName,
                lastName,
                userName,
                email,
                password,
                confirmPassword,
            },
        });
    }

    if (!firstAndLastNameRegex.test(lastName.trim())) {
        return res.status(500).render('./auth/signUp', {
            error: 'Last Name must contain only alphabet character',
            data: {
                firstName,
                lastName,
                userName,
                email,
                password,
                confirmPassword,
            },
        });
    }

    if (!emailRegx.test(email)) {
        return res.status(500).render('./auth/signUp', {
            error: 'Please enter a valid email address',
            data: {
                firstName,
                lastName,
                userName,
                email,
                password,
                confirmPassword,
            },
        });
    }

    if (pwdRegex.test(password)) {
        return res.status(500).render('./auth/signUp', {
            error:
                'Your password must contain a minimum of 8 letter, with at least a symbol, upper and lower case letters and a number',
            data: {
                firstName,
                lastName,
                userName,
                email,
                password,
            },
        });
    }

    if (password !== confirmPassword) {
        return res.status(500).render('./auth/signUp', {
            error: 'Password does not match',
            data: {
                firstName,
                lastName,
                userName,
                email,
                password,
                confirmPassword,
            },
        });
    }
    // Check if the username or email already taken
    User.findOne({ $or: [{ email }, { userName }] }, (err, doc) => {
        if (doc) {
            let error = 'Username already taken!';
            if (doc.email == email) error = 'Email already taken!';
            console.log(error);
            return res.status(401).render('./auth/logIn', {
                error,
                data: {
                    firstName,
                    lastName,
                    email,
                    userName,
                    password,
                    confirmPassword,
                },
            });
        }
        User.findOne({ userName }, (err, doc) => {
            if (doc) {
                return res.status(401).render('./auth/logIn', {
                    error: 'Username already taken!',
                    data: {
                        firstName,
                        lastName,
                        userName,
                        password,
                        email,
                        confirmPassword,
                    },
                });
            }
            const newUser = new User(req.body);

            newUser.save((err, doc) => {
                if (err || !doc) {
                    return res.status(422).render('./auth/logIn', {
                        error: 'Oops something went wrong!',
                        data: {
                            firstName,
                            lastName,
                            userName,
                            email,
                            password,
                        },
                    });
                }
                const token = jwt.sign(
                    { _id: doc._id },
                    process.env.SECRET_KEY
                );

                // Send back the token to the user as a httpOnly cookie
                res.cookie('token', token, {
                    httpOnly: true,
                });
                res.redirect('/');
            });
        });
    });
});

// POST request for log in
router.post('/log-in', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(401).render('./auth/logIn', {
            error: 'Please add all the fields!',
            data: {
                email: email || '',
                password: password || '',
            },
        });
    }

    User.findOne({ email }, (err, doc) => {
        if (err || !doc) {
            return res.status(401).render('./auth/logIn', {
                error: 'Invalid email or password!',
                data: {
                    email,
                    password,
                },
            });
        }
        bcrypt.compare(password, doc.password, (err, matched) => {
            if (err || !matched) {
                return res.status(401).render('./auth/logIn', {
                    error: 'Invalid email or password!',
                    data: {
                        email,
                        password,
                    },
                });
            }

            const token = jwt.sign(
                { _id: doc._id, email },
                process.env.SECRET_KEY
            );

            res.cookie('token', token, {
                httpOnly: true,
            });

            res.redirect('/');
        });
    });
});

// Post route for log-out
router.post('/log-out', auth, async (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

//* route    /author/:id
//* desc     Fetch the required user's blogs
router.get('/author/:id', auth, async (req, res) => {
    // If the requested author is the currently logged in user then redirect them to their dashbaord
    if (req.user) {
        if (req.params.id.toString() === req.user._id.toString())
            return res.redirect('/dashboard');
    } else {
        return res.redirect('/log-in');
    }
    try {
        try {
            const user = await User.findById(req.params.id);
            if (!user) return res.redirect('/error');
            let toggleunfollow = false;
            user.followers.forEach((item) => {
                if (item.toString() === req.user._id.toString()) {
                    toggleunfollow = true;
                }
            });
            const likedBlogs = await Blog.find({
                _id: { $in: user.likedPosts },
                status: 'Public',
            });
            const blogs = await Blog.find({
                author: req.params.id,
                status: 'Public',
            })
                .populate('author')
                .sort({ timestamps: 'desc' })
                .lean();
            return res.render('./useritems/author', {
                user,
                toggleunfollow,
                posts: blogs,
                isAuthenticated: !!req.user,
                likedBlogs: likedBlogs,
            });
        } catch (error) {
            return res.redirect('/error');
        }
    } catch (error) {
        return res.redirect('/error');
    }
});

//* route    /dashboard/
//* desc     Fetch the logged in user's blogs
router.get('/dashboard', auth, async (req, res) => {
    if (!req.user) return res.redirect('/log-in');
    try {
        try {
            const user = await User.findById(req.user._id);
            if (!user) return res.redirect('/error');
            const blogs = await Blog.find({ author: req.user._id })
                .populate('author')
                .sort({ timestamps: 'desc' })
                .lean();
            const allusers = await User.find({});
            const likedBlogs = await Blog.find({
                _id: { $in: user.likedPosts },
            });
            return res.render('./useritems/dashboard', {
                user,
                allusers,
                posts: blogs,
                isAuthenticated: !!req.user,
                likedBlogs: likedBlogs,
            });
        } catch (error) {
            return res.redirect('/error');
        }
    } catch (error) {
        return res.redirect('/error');
    }
});

router.get('/follow/:id', auth, async (req, res) => {
    if (!req.user) return res.redirect('/log-in');

    User.findByIdAndUpdate(
        req.params.id,
        {
            $push: { followers: req.user._id },
        },
        { new: true },
        (err, result) => {
            if (err) {
                return res.status(422).json({ error: err });
            }
            User.findByIdAndUpdate(
                req.user._id,
                {
                    $push: { following: req.params.id },
                },
                { new: true }
            )
                .select('-password')
                .then((result) => res.redirect(`/author/${req.params.id}`))
                .catch((err) => res.status(422).json({ error: err }));
        }
    );
});

router.get('/unfollow/:id', auth, async (req, res) => {
    if (!req.user) return res.redirect('/log-in');

    User.findByIdAndUpdate(
        req.params.id,
        {
            $pull: { followers: req.user._id },
        },
        { new: true },
        (err, result) => {
            if (err) {
                return res.status(422).json({ error: err });
            }
            User.findByIdAndUpdate(
                req.user._id,
                {
                    $pull: { following: req.params.id },
                },
                { new: true }
            )
                .select('-password')
                .then((result) => res.redirect(`/author/${req.params.id}`))
                .catch((err) => res.status(422).json({ error: err }));
        }
    );
});

module.exports = router;
