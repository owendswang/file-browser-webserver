const handleErrorContent = (error) => {
  if (error.response && typeof(error.response.data) === 'object') {
    if (error.response.data.error_description) {
      return error.response.data.error_description;
    } else {
      return JSON.stringify(error.response.data);
    }
  } else if (error.response && typeof(error.response.data) === 'string') {
    const index = error.response.data.indexOf(':');
    if (index > -1) {
      return error.response.data.slice(index + 1).trim();
    } else {
      return error.response.data;
    }
  } else if (typeof(error) === 'string') {
    const index = error.indexOf(':');
    if (index > -1) {
      return error.slice(index + 1).trim();
    } else {
      return error;
    }
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return error;
  }
}

export default handleErrorContent;