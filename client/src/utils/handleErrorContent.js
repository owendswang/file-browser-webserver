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
  } else {
    return error.message;
  }
}

export default handleErrorContent;