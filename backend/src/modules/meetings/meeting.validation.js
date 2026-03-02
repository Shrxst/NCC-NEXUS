const validateCreateMeeting = (data) => {
  const errors = [];

  if (!data.title || typeof data.title !== "string") {
    errors.push("Title is required");
  }

  if (!data.scheduled_at) {
    errors.push("Scheduled time is required");
  } else {
    const scheduledDate = new Date(data.scheduled_at);
    const now = new Date();

    if (isNaN(scheduledDate.getTime())) {
      errors.push("Invalid scheduled_at format");
    }

    if (scheduledDate <= now) {
      errors.push("Scheduled time must be in the future");
    }
  }

  return errors;
};

module.exports = {
  validateCreateMeeting,
};