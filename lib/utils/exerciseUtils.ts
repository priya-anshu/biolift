const exerciseNameMapping: Record<string, string> = {};
const exerciseMediaEnabled = false;

export const getExerciseImagePaths = (exerciseName: string) => {
  if (!exerciseMediaEnabled) return null;
  const directoryName = exerciseNameMapping[exerciseName];
  if (!directoryName) return null;
  return {
    image0: `/exercises/${directoryName}/0.jpg`,
    image1: `/exercises/${directoryName}/1.jpg`,
  };
};

export const getExerciseImage = (exerciseName: string) => {
  const paths = getExerciseImagePaths(exerciseName);
  return paths ? paths.image0 : null;
};

export const checkExerciseImageExists = async (exerciseName: string) => {
  const imagePath = getExerciseImage(exerciseName);
  if (!imagePath) return false;
  try {
    const response = await fetch(imagePath, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
};

export const getExerciseData = async (exerciseName: string) => {
  if (!exerciseMediaEnabled) return null;
  const directoryName = exerciseNameMapping[exerciseName];
  if (!directoryName) return null;
  try {
    const response = await fetch(`/exercises/${directoryName}.json`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    return null;
  }
  return null;
};

export const getAllExerciseImages = () =>
  Object.entries(exerciseNameMapping).map(([displayName, directoryName]) => ({
    displayName,
    directoryName,
    imagePaths: {
      image0: `/exercises/${directoryName}/0.jpg`,
      image1: `/exercises/${directoryName}/1.jpg`,
    },
  }));
