const Student = require('../model/student&participant');
const User = require('../model/usermodel');

// ✅ Create or update student profile
exports.createOrUpdateStudent = async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware (JWT)
    const {
      college,
      department,
      yearOfStudy,
      regNumber,
      bio,
      linkedin,
      leetcode,
      github,
    } = req.body;

    let student = await Student.findOne({ user: userId });

    if (student) {
      // Update existing student
      student = await Student.findOneAndUpdate(
        { user: userId },
        { college, department, yearOfStudy, regNumber, bio, linkedin, leetcode, github },
        { new: true }
      );
      return res.status(200).json({ message: 'Profile updated successfully', student });
    }

    // Create new student profile
    student = new Student({
      user: userId,
      college,
      department,
      yearOfStudy,
      regNumber,
      bio,
      linkedin,
      leetcode,
      github,
    });

    await student.save();
    res.status(201).json({ message: 'Profile created successfully', student });
  } catch (err) {
    console.error('Error in createOrUpdateStudent:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Get logged-in student profile
exports.getStudentProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const student = await Student.findOne({ user: userId })
      .populate('user', 'name email role college profilePic')
      .populate('registeredFests registeredEvents registeredCompetitions');

    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    res.status(200).json(student);
  } catch (err) {
    console.error('Error in getStudentProfile:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Get all registered fest
exports.getRegisteredFests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const student = await Student.findOne({ user: userId }).populate('registeredFests');

    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    res.status(200).json(student.registeredFests);
  } catch (err) {
    console.error('Error in getRegisteredFests:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Get all registered events
exports.getRegisteredEvents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const student = await Student.findOne({ user: userId }).populate('registeredEvents');

    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    res.status(200).json(student.registeredEvents);
  } catch (err) {
    console.error('Error in getRegisteredEvents:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ Get all registered competitions
exports.getRegisteredCompetitions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const student = await Student.findOne({ user: userId }).populate('registeredCompetitions');

    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    res.status(200).json(student.registeredCompetitions);
  } catch (err) {
    console.error('Error in getRegisteredCompetitions:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
