function SelectSentence(a_num)
{
    // get input form and URL to use to add sentence
    var form = $("form[name='submit-form']");
    $("input[name='s']", form).attr("value", a_num);
    form.submit();
};